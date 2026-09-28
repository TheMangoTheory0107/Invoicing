import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { syncInvoiceToSheet } from "@/lib/sheetSync";

// Recomputes amountPaid/status for an invoice from its payments, then re-syncs the register row.
export async function recomputeInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true },
  });

  const amountPaid = invoice.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
  const tdsDeducted = invoice.payments.reduce((sum, p) => sum + toNumber(p.tdsAmount), 0);
  const total = toNumber(invoice.totalAmount);
  // An invoice counts as settled once cash received + TDS withheld covers the total — TDS
  // isn't cash you'll ever see, but it's not outstanding either: it's remitted to the
  // government on your behalf and you claim it back via Form 26AS / the payer's TDS
  // certificate, so it shouldn't sit in "PARTIAL"/unpaid forever.
  const settled = amountPaid + tdsDeducted;
  const status = settled <= 0 ? "UNPAID" : settled >= total ? "PAID" : "PARTIAL";

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid, tdsDeducted, status },
    include: { client: true, creator: true, payments: true },
  });

  const syncResult = await syncInvoiceToSheet(updated);
  return { invoice: updated, syncResult };
}
