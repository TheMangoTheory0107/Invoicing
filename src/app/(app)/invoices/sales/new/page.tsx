import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import PageHeader from "@/components/PageHeader";
import SalesInvoiceForm from "@/components/SalesInvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewSalesInvoicePage() {
  const [clients, creators, settings] = await Promise.all([
    prisma.party.findMany({ where: { type: "CLIENT" }, orderBy: { name: "asc" } }),
    prisma.party.findMany({ where: { type: "CREATOR" }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <div>
      <PageHeader title="New sales invoice" subtitle="Auto-numbered on save, and filed as a PDF" />
      <div className="px-8 pb-12">
        <SalesInvoiceForm clients={clients} creatorParties={creators} defaultTerms={settings.termsAndConditions} />
      </div>
    </div>
  );
}
