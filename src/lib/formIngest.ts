import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { toNumber } from "@/lib/format";
import { extractPurchaseBill, GeminiExtractError } from "@/lib/geminiExtract";
import { detectPurchaseBillFileKind, mimeTypeForKind } from "@/lib/purchaseBillFileType";
import { xlsxBufferToText, csvBufferToText } from "@/lib/purchaseBillTextExtract";
import { extractDriveFileId, downloadDriveFileAsUser, DriveSyncError } from "@/lib/googleDrive";
import { getFormResponseSheet, colorSheetRow, SheetSyncError } from "@/lib/googleSheets";
import { syncOriginalBillToDrive } from "@/lib/driveSync";
import { createPurchaseInvoice } from "@/lib/invoiceService";
import { sendPlainEmail } from "@/lib/email";

// Only this many brand-new bills get Gemini-extracted per run — each one can take up to ~45s
// (the extraction's own retry/fallback chain), and this has to fit inside the serverless
// function's timeout. Anything beyond this count on a given run just waits for the next one.
const MAX_NEW_PER_RUN = 3;
// Loose amount match tolerance (rupees) when reconciling a sheet row against an invoice that's
// already in the app but wasn't created from this form — rounding differences only.
const AMOUNT_TOLERANCE = 2;
const DATE_PROXIMITY_DAYS = 10;

export interface FormIngestSummary {
  attempted: boolean;
  ok: boolean;
  checked: number;
  created: number;
  matchedExisting: number;
  flagged: number;
  errors: string[];
}

function findHeaderIndex(headers: string[], ...candidates: string[]): number {
  const norm = (s: string) => s.trim().toLowerCase();
  for (const c of candidates) {
    const idx = headers.findIndex((h) => norm(h) === norm(c));
    if (idx !== -1) return idx;
  }
  return -1;
}

// "1,30,000/-" / "71100" / "60,873" -> 130000 / 71100 / 60873
function parseRupeeAmount(text: string): number | null {
  const digits = text.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = parseFloat(digits);
  return Number.isFinite(n) ? n : null;
}

function parseLooseDate(text: string): Date | null {
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function matchOrCreateCreator(vendorName: string, extracted: Awaited<ReturnType<typeof extractPurchaseBill>>) {
  const creators = await prisma.party.findMany({ where: { type: "CREATOR" } });
  const vendorLower = vendorName.trim().toLowerCase();
  const matched =
    creators.find((c) => c.name.trim().toLowerCase() === vendorLower) ||
    creators.find(
      (c) => vendorLower.length > 2 && (c.name.toLowerCase().includes(vendorLower) || vendorLower.includes(c.name.toLowerCase()))
    );
  if (matched) return matched;
  if (!vendorName.trim()) return null;
  return prisma.party.create({
    data: {
      type: "CREATOR",
      name: vendorName,
      gstin: extracted.vendorGstin || "",
      panNo: extracted.vendorPan || "",
      bankAccName: extracted.vendorBankAccName || "",
      bankName: extracted.vendorBankName || "",
      bankAccNo: extracted.vendorBankAccNo || "",
      ifsc: extracted.vendorIfsc || "",
      upiId: extracted.vendorUpiId || "",
    },
  });
}

// Auto-ingests a creator bill-submission Google Form: for each response row with an "Invoice
// Copy" attachment, either recognizes it as a bill already in the app (and just marks the row
// green), or downloads the attachment, runs it through the same Gemini extraction the manual
// upload uses, and creates the Purchase bill automatically. Never throws — a bad row is
// flagged and skipped, the rest of the run continues.
export async function syncFormResponses(): Promise<FormIngestSummary> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config?.formResponsesSpreadsheetId || !config.serviceAccountJson || !config.formResponsesImpersonate) {
    return { attempted: false, ok: true, checked: 0, created: 0, matchedExisting: 0, flagged: 0, errors: [] };
  }
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    return {
      attempted: true,
      ok: false,
      checked: 0,
      created: 0,
      matchedExisting: 0,
      flagged: 0,
      errors: ["No Gemini API key configured in Settings — needed to read the attached bills."],
    };
  }

  const sheetName = config.formResponsesSheetName || "Form Responses 1";
  const errors: string[] = [];
  let checked = 0;
  let created = 0;
  let matchedExisting = 0;
  let flagged = 0;
  let newProcessedThisRun = 0;

  let sheet;
  try {
    sheet = await getFormResponseSheet(config.serviceAccountJson, config.formResponsesSpreadsheetId, sheetName);
  } catch (err) {
    const message = err instanceof SheetSyncError ? err.message : err instanceof Error ? err.message : "Could not read the form responses sheet.";
    return { attempted: true, ok: false, checked: 0, created: 0, matchedExisting: 0, flagged: 0, errors: [message] };
  }

  const nameCol = findHeaderIndex(sheet.headers, "Name");
  const channelCol = findHeaderIndex(sheet.headers, "Channel Name (YT or IG)", "Channel Name");
  const invoiceNumberCol = findHeaderIndex(sheet.headers, "Invoice Number");
  const invoiceDateCol = findHeaderIndex(sheet.headers, "Invoice Date");
  const payoutCol = findHeaderIndex(sheet.headers, "Total Payout (Rs.)", "Total Payout");
  const attachmentCol = findHeaderIndex(sheet.headers, "Invoice Copy");
  if (attachmentCol === -1) {
    return {
      attempted: true,
      ok: false,
      checked: 0,
      created: 0,
      matchedExisting: 0,
      flagged: 0,
      errors: ['No "Invoice Copy" column found in that sheet — check the tab name and headers in Settings.'],
    };
  }

  for (const row of sheet.rows) {
    const attachmentLink = row.values[attachmentCol]?.trim();
    if (!attachmentLink) continue;
    const fileId = extractDriveFileId(attachmentLink);
    if (!fileId) continue;

    checked++;

    const already = await prisma.invoice.findUnique({ where: { formSubmissionFileId: fileId } });
    if (already) {
      await colorSheetRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.formResponsesSpreadsheetId,
        sheetId: sheet.sheetId,
        rowIndex: row.rowIndex,
        columnCount: sheet.headers.length,
        color: "green",
      }).catch(() => {});
      continue;
    }

    // The form has both a "Name" and a "Channel Name" field, and an existing Creator party
    // could plausibly be stored under either one — both are tried as candidates for a match,
    // not just whichever happens to be first.
    const rowDisplayName =
      (nameCol !== -1 ? row.values[nameCol]?.trim() : "") || (channelCol !== -1 ? row.values[channelCol]?.trim() : "") || "";
    const rowNameCandidates = [nameCol !== -1 ? row.values[nameCol] : "", channelCol !== -1 ? row.values[channelCol] : ""]
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const rowInvoiceNumber = invoiceNumberCol !== -1 ? row.values[invoiceNumberCol]?.trim() : "";
    const rowPayout = payoutCol !== -1 ? parseRupeeAmount(row.values[payoutCol] || "") : null;
    const rowDate = invoiceDateCol !== -1 ? parseLooseDate(row.values[invoiceDateCol] || "") : null;

    // Reconcile against a bill already entered some other way, before touching Gemini at all.
    // No DB-level name filter here — a reverse-direction loose match (the row's name contains
    // the stored creator's shorter name, not the other way round) would otherwise never even
    // be fetched, so every un-tagged Purchase bill is pulled and matched in JS instead.
    if (rowNameCandidates.length > 0 && rowPayout != null) {
      const candidates = await prisma.invoice.findMany({
        where: { type: "PURCHASE", formSubmissionFileId: null },
        include: { creator: true },
      });
      const reconciled = candidates.find((inv) => {
        const creatorName = inv.creator?.name.trim().toLowerCase() || "";
        if (!creatorName) return false;
        const nameOk = rowNameCandidates.some((n) => creatorName.includes(n) || n.includes(creatorName));
        const amountOk = Math.abs(toNumber(inv.totalAmount) - rowPayout) <= AMOUNT_TOLERANCE;
        const dateOk =
          !rowDate || !inv.date || Math.abs(inv.date.getTime() - rowDate.getTime()) <= DATE_PROXIMITY_DAYS * 86400000;
        return nameOk && amountOk && dateOk;
      });
      if (reconciled) {
        await prisma.invoice.update({ where: { id: reconciled.id }, data: { formSubmissionFileId: fileId } });
        await colorSheetRow({
          serviceAccountJson: config.serviceAccountJson,
          spreadsheetId: config.formResponsesSpreadsheetId,
          sheetId: sheet.sheetId,
          rowIndex: row.rowIndex,
          columnCount: sheet.headers.length,
          color: "green",
        }).catch(() => {});
        matchedExisting++;
        continue;
      }
    }

    // Brand new — needs Gemini. Budget-limited per run.
    if (newProcessedThisRun >= MAX_NEW_PER_RUN) continue;
    newProcessedThisRun++;

    try {
      const file = await downloadDriveFileAsUser({
        serviceAccountJson: config.serviceAccountJson,
        impersonate: config.formResponsesImpersonate,
        fileId,
      });
      const detected = detectPurchaseBillFileKind(file.name, file.mimeType);
      if ("error" in detected) throw new Error(detected.error);

      const extracted =
        detected.kind === "pdf"
          ? await extractPurchaseBill({ kind: "pdf", buffer: file.buffer }, settings.geminiApiKey, settings.geminiModel)
          : await extractPurchaseBill(
              { kind: "text", content: detected.kind === "xlsx" ? await xlsxBufferToText(file.buffer) : csvBufferToText(file.buffer) },
              settings.geminiApiKey,
              settings.geminiModel
            );

      const creator = await matchOrCreateCreator(extracted.vendorName || rowDisplayName, extracted);
      if (!creator) throw new Error("Could not identify or create a creator for this bill.");

      const vendorInvoiceNumber = extracted.invoiceNumber?.trim();
      if (vendorInvoiceNumber) {
        const existingForCreator = await prisma.invoice.findMany({
          where: { type: "PURCHASE", creatorId: creator.id, vendorInvoiceNumber: { not: null } },
          select: { vendorInvoiceNumber: true },
        });
        const isDuplicate = existingForCreator.some(
          (inv) => inv.vendorInvoiceNumber?.trim().toLowerCase() === vendorInvoiceNumber.toLowerCase()
        );
        if (isDuplicate) throw new Error(`Looks like a duplicate — ${creator.name} already has an invoice numbered "${vendorInvoiceNumber}" on file.`);
      }

      const { invoice } = await createPurchaseInvoice({
        creatorId: creator.id,
        date: extracted.invoiceDate || new Date().toISOString().slice(0, 10),
        dueDate: extracted.dueDate || null,
        billAmount: extracted.billAmount,
        gstAmount: extracted.gstAmount,
        reimbursements: 0,
        vendorInvoiceNumber: vendorInvoiceNumber || rowInvoiceNumber || "",
        hasSourcePdf: true,
        notes: "",
        termsAndConditions: settings.termsAndConditions,
        lineItems:
          extracted.lineItems?.map((li) => ({
            description: li.description,
            link1: "",
            link2: "",
            qty: li.qty || 1,
            rate: li.rate || li.amount,
            amount: li.amount,
          })) || [],
      });

      await prisma.invoice.update({ where: { id: invoice.id }, data: { formSubmissionFileId: fileId } });

      const driveResult = await syncOriginalBillToDrive({
        fy: invoice.fy,
        month: invoice.month,
        number: invoice.number,
        partyName: creator.name,
        fileBuffer: file.buffer,
        mimeType: mimeTypeForKind(detected.kind),
        fileExt: detected.kind,
      });
      if (driveResult.link) {
        await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: driveResult.link } });
      }

      await colorSheetRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.formResponsesSpreadsheetId,
        sheetId: sheet.sheetId,
        rowIndex: row.rowIndex,
        columnCount: sheet.headers.length,
        color: "green",
      }).catch(() => {});

      if (settings.emailFromAddress && settings.emailAppPassword) {
        await sendPlainEmail({
          fromAddress: settings.emailFromAddress,
          appPassword: settings.emailAppPassword,
          fromName: settings.companyName,
          to: settings.emailFromAddress,
          subject: `New Purchase bill auto-added: ${invoice.number} — ${creator.name}`,
          html: `<p>A new Purchase bill was auto-created from a form submission.</p><p><strong>${creator.name}</strong> — ${invoice.number} — ₹${toNumber(invoice.totalAmount).toLocaleString("en-IN")}</p>`,
        }).catch(() => {});
      }

      created++;
    } catch (err) {
      const message =
        err instanceof GeminiExtractError || err instanceof DriveSyncError || err instanceof Error
          ? err.message
          : "Could not process this row.";
      errors.push(`${rowDisplayName || `Row ${row.rowIndex + 1}`}: ${message}`);
      flagged++;
      await colorSheetRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.formResponsesSpreadsheetId,
        sheetId: sheet.sheetId,
        rowIndex: row.rowIndex,
        columnCount: sheet.headers.length,
        color: "flag",
      }).catch(() => {});
    }
  }

  return { attempted: true, ok: true, checked, created, matchedExisting, flagged, errors };
}
