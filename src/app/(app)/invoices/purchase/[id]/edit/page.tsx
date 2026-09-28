import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import PurchaseInvoiceForm from "@/components/PurchaseInvoiceForm";

export const dynamic = "force-dynamic";

export default async function EditPurchaseInvoicePage({ params }: { params: { id: string } }) {
  const [invoice, creators] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.party.findMany({ where: { type: "CREATOR" }, orderBy: { name: "asc" } }),
  ]);

  if (!invoice || invoice.type !== "PURCHASE") notFound();

  return (
    <div>
      <PageHeader title={`Edit ${invoice.number}`} />
      <div className="px-8 pb-12">
        <PurchaseInvoiceForm
          creators={creators}
          initial={{
            id: invoice.id,
            creatorId: invoice.creatorId || "",
            date: invoice.date.toISOString().slice(0, 10),
            dueDate: invoice.dueDate?.toISOString().slice(0, 10) || "",
            gstAmount: toNumber(invoice.gstAmount),
            reimbursements: toNumber(invoice.reimbursements),
            termsAndConditions: invoice.termsAndConditions || "",
            notes: invoice.notes || "",
            vendorInvoiceNumber: invoice.vendorInvoiceNumber || "",
            lineItems: invoice.lineItems.map((li) => ({
              description: li.description,
              link1: li.link1 || "",
              link2: li.link2 || "",
              qty: toNumber(li.qty),
              rate: toNumber(li.rate),
              amount: toNumber(li.amount),
            })),
          }}
        />
      </div>
    </div>
  );
}
