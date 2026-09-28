import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { extractPurchaseBill, GeminiExtractError } from "@/lib/geminiExtract";
import { detectPurchaseBillFileKind } from "@/lib/purchaseBillFileType";
import { xlsxBufferToText, csvBufferToText } from "@/lib/purchaseBillTextExtract";

// Reads an uploaded Purchase bill (PDF, Excel, or CSV) via Gemini, then tries to match the extracted vendor
// name against an existing Creator party (case-insensitive exact match first, then a loose
// contains-match either direction) so the form can pre-select them instead of leaving it blank.
export async function POST(req: NextRequest) {
  const settings = await getSettings();
  if (!settings.geminiApiKey) {
    return NextResponse.json(
      { error: "No Gemini API key configured — add one in Settings → Purchase bill auto-read first." },
      { status: 400 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const detected = detectPurchaseBillFileKind(file.name, file.type);
  if ("error" in detected) {
    return NextResponse.json({ error: detected.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    let extracted;
    if (detected.kind === "pdf") {
      extracted = await extractPurchaseBill({ kind: "pdf", buffer }, settings.geminiApiKey, settings.geminiModel);
    } else {
      const content = detected.kind === "xlsx" ? await xlsxBufferToText(buffer) : csvBufferToText(buffer);
      if (!content.trim()) {
        return NextResponse.json({ error: "That file appears to be empty." }, { status: 400 });
      }
      extracted = await extractPurchaseBill({ kind: "text", content }, settings.geminiApiKey, settings.geminiModel);
    }

    const creators = await prisma.party.findMany({ where: { type: "CREATOR" } });
    const vendorLower = extracted.vendorName.trim().toLowerCase();
    const matched =
      creators.find((c) => c.name.trim().toLowerCase() === vendorLower) ||
      creators.find(
        (c) =>
          vendorLower.length > 2 &&
          (c.name.toLowerCase().includes(vendorLower) || vendorLower.includes(c.name.toLowerCase()))
      );

    // Backfill GSTIN/PAN/bank details onto an existing creator if the bill has them and the
    // party record doesn't yet — so payment details fill in over time from real bills instead
    // of staying blank forever just because the creator was originally added without them.
    if (matched) {
      const patch: {
        gstin?: string;
        panNo?: string;
        bankAccName?: string;
        bankName?: string;
        bankAccNo?: string;
        ifsc?: string;
        upiId?: string;
      } = {};
      if (!matched.gstin && extracted.vendorGstin) patch.gstin = extracted.vendorGstin;
      if (!matched.panNo && extracted.vendorPan) patch.panNo = extracted.vendorPan;
      if (!matched.bankAccName && extracted.vendorBankAccName) patch.bankAccName = extracted.vendorBankAccName;
      if (!matched.bankName && extracted.vendorBankName) patch.bankName = extracted.vendorBankName;
      if (!matched.bankAccNo && extracted.vendorBankAccNo) patch.bankAccNo = extracted.vendorBankAccNo;
      if (!matched.ifsc && extracted.vendorIfsc) patch.ifsc = extracted.vendorIfsc;
      if (!matched.upiId && extracted.vendorUpiId) patch.upiId = extracted.vendorUpiId;
      if (Object.keys(patch).length > 0) {
        await prisma.party.update({ where: { id: matched.id }, data: patch });
      }
    }

    // Flag a likely duplicate: same creator, same vendor invoice number already on file.
    // Only checked when both are known — a missing invoice number on either side can't be
    // compared reliably, so it's left alone rather than risking a false match.
    let possibleDuplicate = null;
    const vendorInvoiceNumber = extracted.invoiceNumber?.trim();
    if (matched && vendorInvoiceNumber) {
      const existingForCreator = await prisma.invoice.findMany({
        where: { type: "PURCHASE", creatorId: matched.id, vendorInvoiceNumber: { not: null } },
        select: { id: true, number: true, vendorInvoiceNumber: true, date: true, totalAmount: true },
      });
      const dup = existingForCreator.find(
        (inv) => inv.vendorInvoiceNumber?.trim().toLowerCase() === vendorInvoiceNumber.toLowerCase()
      );
      if (dup) {
        possibleDuplicate = {
          id: dup.id,
          number: dup.number,
          vendorInvoiceNumber: dup.vendorInvoiceNumber,
          date: dup.date.toISOString(),
          totalAmount: dup.totalAmount.toString(),
        };
      }
    }

    return NextResponse.json({ extracted, matchedCreatorId: matched?.id || null, possibleDuplicate });
  } catch (err) {
    const message = err instanceof GeminiExtractError ? err.message : "Could not read that file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
