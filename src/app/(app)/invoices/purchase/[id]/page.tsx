import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import InvoiceDetail from "@/components/InvoiceDetail";

export const dynamic = "force-dynamic";

export default async function PurchaseInvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      creator: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!invoice || invoice.type !== "PURCHASE") notFound();

  return (
    <div>
      <PageHeader
        title={invoice.vendorInvoiceNumber || invoice.number}
        subtitle={invoice.vendorInvoiceNumber ? `Purchase bill · our ref ${invoice.number}` : "Purchase bill"}
      />
      <div className="px-8">
        <InvoiceDetail
          data={{
            id: invoice.id,
            type: "PURCHASE",
            number: invoice.number,
            date: invoice.date.toISOString(),
            dueDate: invoice.dueDate?.toISOString() || null,
            status: invoice.status,
            amountPaid: toNumber(invoice.amountPaid),
            tdsDeducted: toNumber(invoice.tdsDeducted),
            billAmount: toNumber(invoice.billAmount),
            gstAmount: toNumber(invoice.gstAmount),
            reimbursements: toNumber(invoice.reimbursements),
            totalAmount: toNumber(invoice.totalAmount),
            pdfPath: invoice.pdfPath,
            hasSourcePdf: invoice.hasSourcePdf,
            vendorInvoiceNumber: invoice.vendorInvoiceNumber,
            collaborationBrand: null,
            partyName: invoice.creator?.name || "—",
            partyId: invoice.creatorId,
            lineItems: invoice.lineItems.map((li) => ({
              id: li.id,
              description: li.description,
              link1: li.link1,
              link2: li.link2,
              qty: toNumber(li.qty),
              rate: toNumber(li.rate),
              amount: toNumber(li.amount),
            })),
            creators: [],
            payments: invoice.payments.map((p) => ({
              id: p.id,
              date: p.date.toISOString(),
              amount: toNumber(p.amount),
              tdsAmount: toNumber(p.tdsAmount),
              method: p.method,
              reference: p.reference,
            })),
            hasLinkedPurchaseBillsFor: [],
          }}
        />
      </div>
    </div>
  );
}
