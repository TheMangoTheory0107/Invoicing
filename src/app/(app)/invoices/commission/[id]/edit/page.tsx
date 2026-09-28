import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import SalesInvoiceForm from "@/components/SalesInvoiceForm";

export const dynamic = "force-dynamic";

export default async function EditCommissionInvoicePage({ params }: { params: { id: string } }) {
  const [invoice, clients, creators] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: { orderBy: { sortOrder: "asc" } }, creators: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.party.findMany({ where: { type: "CLIENT" }, orderBy: { name: "asc" } }),
    prisma.party.findMany({ where: { type: "CREATOR" }, orderBy: { name: "asc" } }),
  ]);

  if (!invoice || invoice.type !== "COMMISSION") notFound();

  return (
    <div>
      <PageHeader title={`Edit ${invoice.number}`} />
      <div className="px-8 pb-12">
        <SalesInvoiceForm
          clients={clients}
          creatorParties={creators}
          defaultTerms=""
          kind="commission"
          initial={{
            id: invoice.id,
            clientId: invoice.clientId || "",
            date: invoice.date.toISOString().slice(0, 10),
            billingDate1: invoice.billingDate1?.toISOString().slice(0, 10) || "",
            billingDate2: invoice.billingDate2?.toISOString().slice(0, 10) || "",
            dueDate: invoice.dueDate?.toISOString().slice(0, 10) || "",
            collaborationBrand: invoice.collaborationBrand || "",
            gstAmount: toNumber(invoice.gstAmount),
            reimbursements: toNumber(invoice.reimbursements),
            termsAndConditions: invoice.termsAndConditions || "",
            notes: invoice.notes || "",
            lineItems: invoice.lineItems.map((li) => ({
              description: li.description,
              link1: li.link1 || "",
              link2: li.link2 || "",
              qty: toNumber(li.qty),
              rate: toNumber(li.rate),
              amount: toNumber(li.amount),
            })),
            creators: invoice.creators.map((c) => ({
              partyId: c.partyId,
              name: c.name,
              address: c.address || "",
              email: c.email || "",
              phone: c.phone || "",
              pageHandle: c.pageHandle || "",
              gstNumber: c.gstNumber || "",
              link1: c.link1 || "",
              link2: c.link2 || "",
              amount: toNumber(c.amount),
            })),
          }}
        />
      </div>
    </div>
  );
}
