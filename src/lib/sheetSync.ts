import { prisma } from "@/lib/prisma";
import { upsertRegisterRow, deleteRegisterRow, SheetSyncError } from "@/lib/googleSheets";
import { toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import type { Invoice, Party, Payment } from "@prisma/client";

export interface SyncResult {
  attempted: boolean;
  ok: boolean;
  error?: string;
}

type InvoiceWithParties = Invoice & {
  client?: Party | null;
  creator?: Party | null;
  payments?: Payment[];
};

// Every payment recorded against this invoice, oldest first, as "date: amount" pairs — a
// part payment followed later by the balance shows both entries with what was actually
// received on each date, not just a bare list of dates you'd have to go re-derive amounts for.
function paymentHistory(invoice: InvoiceWithParties): string {
  if (!invoice.payments?.length) return "";
  return [...invoice.payments]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => `${formatDateDMY(p.date)}: ₹${Math.round(toNumber(p.amount)).toLocaleString("en-IN")}`)
    .join("; ");
}

// Pushes one invoice's row to its Sales, Commission, or Purchase Register sheet. Never
// throws — returns a result the caller can surface as a warning, so a Sheets outage never
// blocks saving the invoice itself.
export async function syncInvoiceToSheet(invoice: InvoiceWithParties): Promise<SyncResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.enabled || !config.spreadsheetId || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }

  try {
    if (invoice.type === "SALES" || invoice.type === "COMMISSION") {
      await upsertRegisterRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.spreadsheetId,
        sheetName: invoice.type === "SALES" ? config.salesSheetName : config.commissionSheetName,
        keyHeader: "Bill no",
        keyValue: invoice.number,
        values: {
          Month: invoice.month,
          Date: formatDateDMY(invoice.date),
          Agency: invoice.client?.name || "",
          "GST No.": invoice.client?.gstin || "",
          "Bill no": invoice.number,
          "Bill Amount": toNumber(invoice.billAmount),
          GST: toNumber(invoice.gstAmount),
          "Total Amount": toNumber(invoice.totalAmount),
          Status: invoice.status,
          "Amount Paid": toNumber(invoice.amountPaid),
          "TDS Deducted": toNumber(invoice.tdsDeducted),
          Balance: toNumber(invoice.totalAmount) - toNumber(invoice.amountPaid) - toNumber(invoice.tdsDeducted),
          "Payment History": paymentHistory(invoice),
        },
      });
    } else {
      // Keyed on "Internal Ref" (our own number) rather than the vendor's invoice number,
      // since two different vendors could each send an "Invoice #1" — our number is the one
      // guaranteed unique, so it's what safely finds the right row to update on a re-sync.
      await upsertRegisterRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.spreadsheetId,
        sheetName: config.purchaseSheetName,
        keyHeader: "Internal Ref",
        keyValue: invoice.number,
        values: {
          Month: invoice.month,
          Date: formatDateDMY(invoice.date),
          "Vendor Name": invoice.creator?.name || "",
          "Invoice Number": invoice.vendorInvoiceNumber || "",
          "Internal Ref": invoice.number,
          "GST No.": invoice.creator?.gstin || "",
          PAN: invoice.creator?.panNo || "",
          "Bill Amount": toNumber(invoice.billAmount),
          GST: toNumber(invoice.gstAmount),
          "Total Amount": toNumber(invoice.totalAmount),
          "Bank A/c Name": invoice.creator?.bankAccName || "",
          "Bank Name": invoice.creator?.bankName || "",
          "Bank A/c No": invoice.creator?.bankAccNo || "",
          IFSC: invoice.creator?.ifsc || "",
          "UPI ID": invoice.creator?.upiId || "",
          Status: invoice.status,
          "Amount Paid": toNumber(invoice.amountPaid),
          "TDS Deducted": toNumber(invoice.tdsDeducted),
          Balance: toNumber(invoice.totalAmount) - toNumber(invoice.amountPaid) - toNumber(invoice.tdsDeducted),
          "Payment History": paymentHistory(invoice),
        },
      });
    }
    return { attempted: true, ok: true };
  } catch (err) {
    const message = err instanceof SheetSyncError ? err.message : "Unexpected sync error.";
    return { attempted: true, ok: false, error: message };
  }
}

// Removes an invoice's row from its register sheet when the invoice itself is deleted, so
// deleted invoices don't linger behind. Never throws — same as the sync above, a Sheets
// outage should never block deleting the invoice.
export async function deleteInvoiceFromSheet(invoice: InvoiceWithParties): Promise<SyncResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.enabled || !config.spreadsheetId || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }

  try {
    if (invoice.type === "SALES" || invoice.type === "COMMISSION") {
      await deleteRegisterRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.spreadsheetId,
        sheetName: invoice.type === "SALES" ? config.salesSheetName : config.commissionSheetName,
        keyHeader: "Bill no",
        keyValue: invoice.number,
      });
    } else {
      await deleteRegisterRow({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.spreadsheetId,
        sheetName: config.purchaseSheetName,
        keyHeader: "Internal Ref",
        keyValue: invoice.number,
      });
    }
    return { attempted: true, ok: true };
  } catch (err) {
    const message = err instanceof SheetSyncError ? err.message : "Unexpected sync error.";
    return { attempted: true, ok: false, error: message };
  }
}
