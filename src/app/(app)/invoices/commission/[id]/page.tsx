import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import InvoiceDetail from "@/components/InvoiceDetail";

export const dynamic = "force-dynamic";

export default async function CommissionInvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      creators: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!invoice || invoice.type !== "COMMISSION") notFound();

  return (
    <div>
      <PageHeader title={invoice.number} subtitle="Commission invoice" />
      <div className="px-8">
        <InvoiceDetail
          data={{
            id: invoice.id,
            type: "COMMISSION",
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
            poNumber: invoice.poNumber,
            collaborationBrand: invoice.collaborationBrand,
            partyName: invoice.client?.name || "—",
            partyId: invoice.clientId,
            partyEmail: invoice.client?.email,
            lineItems: invoice.lineItems.map((li) => ({
              id: li.id,
              description: li.description,
              link1: li.link1,
              link2: li.link2,
              qty: toNumber(li.qty),
              rate: toNumber(li.rate),
              amount: toNumber(li.amount),
            })),
            creators: invoice.creators.map((c) => ({
              id: c.id,
              name: c.name,
              pageHandle: c.pageHandle,
              amount: toNumber(c.amount),
              partyId: c.partyId,
            })),
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
