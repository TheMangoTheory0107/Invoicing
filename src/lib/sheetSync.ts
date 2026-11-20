import { prisma } from "@/lib/prisma";
import { upsertRegisterRow, deleteRegisterRow, readRegisterColumnByKey, SheetSyncError, type RegisterRowColor } from "@/lib/googleSheets";
import { toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import type { Invoice, Party, Payment } from "@prisma/client";

const REFERENCE_HEADER = "UTR / Reference";

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

// Same order as paymentHistory above — oldest first — so a reference typed back into the sheet
// for "the 2nd payment" lines up with the 2nd entry here when read back in. Empty references
// are kept as empty slots (not dropped) so the positional alignment survives a part payment
// with no reference followed by one that has one.
function paymentReferences(invoice: InvoiceWithParties): string {
  if (!invoice.payments?.length) return "";
  return [...invoice.payments]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((p) => p.reference?.trim() || "")
    .join("; ");
}

function rowColorForStatus(status: string): RegisterRowColor {
  if (status === "PAID") return "paid";
  if (status === "PARTIAL") return "partial";
  return "none";
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
          [REFERENCE_HEADER]: paymentReferences(invoice),
        },
        rowColor: rowColorForStatus(invoice.status),
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
          [REFERENCE_HEADER]: paymentReferences(invoice),
        },
        rowColor: rowColorForStatus(invoice.status),
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

export interface PaymentReferenceBackfillResult {
  ok: boolean;
  invoicesChecked: number;
  paymentsUpdated: number;
  error?: string;
}

// One-time (but safe to re-run) catch-up: reads the "UTR / Reference" column back out of each
// register tab and writes it onto the matching payment(s) in the app — the reverse direction
// of what syncInvoiceToSheet above writes out. Entries line up positionally with payments
// ordered oldest-first, same convention as Payment History; a row with fewer reference entries
// than payments only updates the ones it has, and an empty entry is left alone rather than
// blanking out a reference the app already has.
export async function backfillPaymentReferences(): Promise<PaymentReferenceBackfillResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config?.spreadsheetId || !config.serviceAccountJson) {
    return {
      ok: false,
      invoicesChecked: 0,
      paymentsUpdated: 0,
      error: "Set up the spreadsheet ID and service account in Settings → Google Sheets & Drive sync first.",
    };
  }

  const tabs: { type: "SALES" | "COMMISSION" | "PURCHASE"; sheetName: string; keyHeader: string }[] = [
    { type: "SALES", sheetName: config.salesSheetName, keyHeader: "Bill no" },
    { type: "COMMISSION", sheetName: config.commissionSheetName, keyHeader: "Bill no" },
    { type: "PURCHASE", sheetName: config.purchaseSheetName, keyHeader: "Internal Ref" },
  ];

  let invoicesChecked = 0;
  let paymentsUpdated = 0;
  try {
    for (const tab of tabs) {
      const refMap = await readRegisterColumnByKey({
        serviceAccountJson: config.serviceAccountJson,
        spreadsheetId: config.spreadsheetId,
        sheetName: tab.sheetName,
        keyHeader: tab.keyHeader,
        valueHeader: REFERENCE_HEADER,
      });
      if (refMap.size === 0) continue;

      const invoices = await prisma.invoice.findMany({
        where: { type: tab.type, number: { in: Array.from(refMap.keys()) } },
        include: { payments: true },
      });
      for (const inv of invoices) {
        invoicesChecked++;
        const cellText = refMap.get(inv.number);
        if (!cellText) continue;
        const refs = cellText.split(";").map((s) => s.trim());
        const payments = [...inv.payments].sort((a, b) => a.date.getTime() - b.date.getTime());
        for (let i = 0; i < Math.min(refs.length, payments.length); i++) {
          if (!refs[i] || payments[i].reference === refs[i]) continue;
          await prisma.payment.update({ where: { id: payments[i].id }, data: { reference: refs[i] } });
          paymentsUpdated++;
        }
      }
    }
    return { ok: true, invoicesChecked, paymentsUpdated };
  } catch (err) {
    const message = err instanceof SheetSyncError ? err.message : "Could not read payment references.";
    return { ok: false, invoicesChecked, paymentsUpdated, error: message };
  }
}
