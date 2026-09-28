import { prisma } from "@/lib/prisma";
import {
  parseUploadedFile,
  field,
  parseFlexibleDate,
  parseFlexibleNumber,
  deriveFyMonth,
  parseInvoiceNumber,
} from "@/lib/importRegister";
import { allocateInvoiceNumber } from "@/lib/numbering";

export interface ImportSummary {
  totalRows: number;
  imported: number;
  skipped: number;
  partiesCreated: number;
  errors: string[];
}

async function findOrCreateParty(name: string, type: "CLIENT" | "CREATOR", cache: Map<string, string>) {
  const key = `${type}:${name.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const existing = await prisma.party.findFirst({ where: { type, name } });
  if (existing) {
    cache.set(key, existing.id);
    return existing.id;
  }
  const created = await prisma.party.create({ data: { type, name } });
  cache.set(key, created.id);
  return created.id;
}

export interface ClientImportSummary {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// Bulk-imports a client/agency master list (Name, GST, Address, optional short Agency code).
// Matches existing clients by exact name; fills in GST/address only where currently blank, so
// re-uploading the same file (or a refreshed export) never overwrites hand-edited data.
export async function importClientsFile(buffer: Buffer, filename: string): Promise<ClientImportSummary> {
  const rows = await parseUploadedFile(buffer, filename);
  const summary: ClientImportSummary = { totalRows: rows.length, created: 0, updated: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Row ${i + 2}`;

    try {
      const name = field(row, "Name", "Legal Name", "Company Name", "Agency");
      if (!name) {
        summary.errors.push(`${rowLabel}: missing name, skipped.`);
        summary.skipped++;
        continue;
      }

      const gstin = field(row, "GST", "GSTIN", "GST No.", "GST No");
      const address = field(row, "Address");
      const agencyCode = field(row, "Agency", "Short Name");

      const existing = await prisma.party.findFirst({ where: { type: "CLIENT", name } });
      if (existing) {
        const data: { gstin?: string; address?: string; notes?: string } = {};
        if (gstin && !existing.gstin) data.gstin = gstin;
        if (address && !existing.address) data.address = address;
        if (agencyCode && agencyCode !== name && !existing.notes) data.notes = `Agency code: ${agencyCode}`;
        if (Object.keys(data).length > 0) {
          await prisma.party.update({ where: { id: existing.id }, data });
          summary.updated++;
        } else {
          summary.skipped++;
        }
      } else {
        await prisma.party.create({
          data: {
            type: "CLIENT",
            name,
            gstin: gstin || undefined,
            address: address || undefined,
            notes: agencyCode && agencyCode !== name ? `Agency code: ${agencyCode}` : undefined,
          },
        });
        summary.created++;
      }
    } catch (err) {
      summary.errors.push(`${rowLabel}: ${err instanceof Error ? err.message : "unknown error"}`);
      summary.skipped++;
    }
  }

  return summary;
}

export async function importRegisterFile(
  buffer: Buffer,
  filename: string,
  type: "SALES" | "PURCHASE"
): Promise<ImportSummary> {
  const rows = await parseUploadedFile(buffer, filename);
  const summary: ImportSummary = { totalRows: rows.length, imported: 0, skipped: 0, partiesCreated: 0, errors: [] };
  const partyCache = new Map<string, string>();
  const partiesBefore = await prisma.party.count();
  const maxSeqByTypeFy = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowLabel = `Row ${i + 2}`;

    try {
      const dateStr =
        type === "SALES" ? field(row, "Date") : field(row, "Invoice sent date", "Date");
      const date = parseFlexibleDate(dateStr);
      if (!date) {
        summary.errors.push(`${rowLabel}: missing/unparseable date, skipped.`);
        summary.skipped++;
        continue;
      }

      const originalRef =
        type === "SALES"
          ? field(row, "Bill no", "Bill No", "Invoice number")
          : field(row, "Invoice number", "Bill no");
      if (!originalRef) {
        summary.errors.push(`${rowLabel}: missing bill/invoice number, skipped.`);
        summary.skipped++;
        continue;
      }

      const partyName = type === "SALES" ? field(row, "Agency", "Client", "Name") : field(row, "Name", "Agency");
      if (!partyName) {
        summary.errors.push(`${rowLabel}: missing party name, skipped.`);
        summary.skipped++;
        continue;
      }
      const partyId = await findOrCreateParty(partyName, type === "SALES" ? "CLIENT" : "CREATOR", partyCache);

      const { fy, month } = deriveFyMonth(date);

      const billAmount =
        type === "SALES" ? parseFlexibleNumber(field(row, "Bill Amount")) : parseFlexibleNumber(field(row, "Amount"));
      const gstAmount = parseFlexibleNumber(field(row, "GST"));
      const reimbursements = parseFlexibleNumber(field(row, "Reimbursements", "Reimburements"));
      // "Total Amount" is only trusted when the sheet has a header distinctly named that — never
      // falling back to a generic "Amount" column, since that's already `billAmount`'s source and
      // would silently drop GST/reimbursements from the total.
      const explicitTotal = parseFlexibleNumber(field(row, "Total Amount"));
      const totalAmount = explicitTotal > 0 ? explicitTotal + reimbursements : billAmount + gstAmount + reimbursements;

      // TDS withheld by a client counts toward "collected" for AR purposes — the cash didn't
      // land in the bank, but it's credited against your tax liability, so it clears the balance
      // the same way a receipt does.
      const tds = type === "SALES" ? parseFlexibleNumber(field(row, "TDS")) : 0;

      const statusField = field(row, "Status").toUpperCase();
      let receiptAmount = parseFlexibleNumber(field(row, "Amount Paid", "Paid", "Paid Amount", "Receipt Amount"));
      let settled = receiptAmount + tds;
      let status = "UNPAID";
      if (statusField === "PAID" || settled >= totalAmount) {
        // Absorb any rounding into the cash figure, not the reported TDS — TDS is a fixed number
        // off the register, cash received is the more likely source of a small mismatch.
        if (totalAmount > 0 && settled < totalAmount) {
          receiptAmount += totalAmount - settled;
          settled = totalAmount;
        }
        status = "PAID";
      } else if (settled > 0) {
        status = "PARTIAL";
      }

      const gstin = type === "SALES" ? field(row, "GST No.", "GST No", "GSTIN") : "";

      const paidDateStr = field(row, "Receipt Date", "Paid Date", "Payment Date");
      const paidDate = parseFlexibleDate(paidDateStr) || date;

      const dueDateStr = field(row, "Due Date", "Payment Due Date");
      const dueDate = parseFlexibleDate(dueDateStr);

      const collaborationBrand = type === "SALES" ? field(row, "Brand", "Collaboration Brand") : "";
      const creatorName = type === "SALES" ? field(row, "Name", "Creator") : "";

      // Sales bill numbers are genuine invoice numbers (unique per client/campaign) — reuse them
      // directly. Purchase "bill numbers" in historical registers are often just an informal
      // per-creator counter that different creators reuse (many restart at "1"), so they can't
      // serve as this app's globally-unique Invoice.number. For Purchase, auto-allocate a real
      // number and keep the original reference in notes for traceability; duplicate detection
      // then keys off (creator, date, total amount, paid date, original ref) — matching on amount
      // and paid date too, since rows can legitimately share a creator/date/ref while being
      // separate transactions (different amounts or payment dates), and we don't want to drop those.
      let number: string;
      if (type === "SALES") {
        const existingInvoice = await prisma.invoice.findFirst({ where: { type, number: originalRef } });
        if (existingInvoice) {
          summary.errors.push(`${rowLabel}: ${originalRef} already exists, skipped.`);
          summary.skipped++;
          continue;
        }
        number = originalRef;
      } else {
        const dup = await prisma.invoice.findFirst({
          where: {
            type,
            creatorId: partyId,
            date,
            totalAmount,
            notes: { contains: `Original ref: ${originalRef}` },
          },
          include: { payments: true },
        });
        const isDuplicate =
          dup &&
          (settled <= 0
            ? dup.payments.length === 0
            : dup.payments.some((p) => p.date.getTime() === paidDate.getTime()));
        if (isDuplicate) {
          summary.errors.push(
            `${rowLabel}: ${partyName} / ${originalRef} on this date for this amount already imported, skipped.`
          );
          summary.skipped++;
          continue;
        }
        number = await allocateInvoiceNumber("PURCHASE", fy);
      }

      const notesParts = ["Imported from historical register."];
      if (tds > 0) notesParts.push(`Includes Rs. ${tds} TDS.`);
      if (creatorName) notesParts.push(`Creator: ${creatorName}.`);
      if (type === "PURCHASE") notesParts.push(`Original ref: ${originalRef}.`);

      const invoice = await prisma.invoice.create({
        data: {
          type,
          number,
          fy,
          month,
          date,
          dueDate,
          clientId: type === "SALES" ? partyId : null,
          creatorId: type === "PURCHASE" ? partyId : null,
          collaborationBrand: collaborationBrand || undefined,
          billAmount,
          gstAmount,
          reimbursements,
          totalAmount,
          amountPaid: receiptAmount,
          tdsDeducted: tds,
          status,
          notes: notesParts.join(" "),
        },
      });

      if (settled > 0) {
        await prisma.payment.create({
          data: {
            invoiceId: invoice.id,
            date: paidDate,
            amount: receiptAmount,
            tdsAmount: tds,
            method: "Imported",
            notes:
              tds > 0
                ? `Carried over from imported register (Rs. ${receiptAmount} received + Rs. ${tds} TDS).`
                : "Carried over from imported register.",
          },
        });
      }

      if (gstin && type === "SALES") {
        const party = await prisma.party.findUnique({ where: { id: partyId } });
        if (party && !party.gstin) {
          await prisma.party.update({ where: { id: partyId }, data: { gstin } });
        }
      }

      const parsedNumber = parseInvoiceNumber(number);
      if (parsedNumber) {
        const key = `${type}:${parsedNumber.fy}`;
        maxSeqByTypeFy.set(key, Math.max(maxSeqByTypeFy.get(key) || 0, parsedNumber.seq));
      }

      summary.imported++;
    } catch (err) {
      summary.errors.push(`${rowLabel}: ${err instanceof Error ? err.message : "unknown error"}`);
      summary.skipped++;
    }
  }

  // Advance the live auto-numbering counters past the highest imported number per FY,
  // so newly created invoices never collide with imported historical numbers. Never move
  // a counter backwards — only raise it if the import's max sequence is higher.
  for (const [key, seq] of Array.from(maxSeqByTypeFy.entries())) {
    const [invType, fy] = key.split(":");
    const existing = await prisma.counter.findUnique({ where: { type_fy: { type: invType, fy } } });
    const newValue = Math.max(existing?.lastNumber || 0, seq);
    await prisma.counter.upsert({
      where: { type_fy: { type: invType, fy } },
      create: { type: invType, fy, lastNumber: newValue },
      update: { lastNumber: newValue },
    });
  }

  const partiesAfter = await prisma.party.count();
  summary.partiesCreated = partiesAfter - partiesBefore;

  return summary;
}
