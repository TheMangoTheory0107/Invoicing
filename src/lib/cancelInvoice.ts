import { prisma } from "@/lib/prisma";
import { syncInvoiceToSheet } from "@/lib/sheetSync";
import { recomputeInvoiceStatus } from "@/lib/payments";

export class CancelInvoiceError extends Error {}

// Cancelling only applies to an invoice with no payments recorded — a cancelled invoice with
// real money against it would be a confusing half-state, so that money has to be removed
// first (or the invoice simply shouldn't be cancelled). Reactivating just recomputes status
// the normal way, which lands back on UNPAID since a reactivated invoice never has payments.
export async function setInvoiceCancelled(invoiceId: string, cancelled: boolean) {
  if (!cancelled) {
    return recomputeInvoiceStatus(invoiceId);
  }

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (invoice.payments.length > 0) {
    throw new CancelInvoiceError(
      "This invoice has payments recorded against it — remove them first, then cancel."
    );
  }

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: "CANCELLED" },
    include: { client: true, creator: true, payments: true },
  });
  const syncResult = await syncInvoiceToSheet(updated);
  return { invoice: updated, syncResult };
}
