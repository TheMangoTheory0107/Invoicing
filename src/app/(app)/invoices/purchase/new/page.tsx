import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import PurchaseInvoiceForm from "@/components/PurchaseInvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseInvoicePage() {
  const creators = await prisma.party.findMany({ where: { type: "CREATOR" }, orderBy: { name: "asc" } });

  return (
    <div>
      <PageHeader title="New purchase bill" subtitle="Auto-numbered on save, and filed as a PDF" />
      <div className="px-8 pb-12">
        <PurchaseInvoiceForm creators={creators} />
      </div>
    </div>
  );
}
