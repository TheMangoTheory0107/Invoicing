import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import PageHeader from "@/components/PageHeader";
import SalesInvoiceForm from "@/components/SalesInvoiceForm";

export const dynamic = "force-dynamic";

export default async function NewCommissionInvoicePage() {
  const [clients, creators, settings] = await Promise.all([
    prisma.party.findMany({ where: { type: "CLIENT" }, orderBy: { name: "asc" } }),
    prisma.party.findMany({ where: { type: "CREATOR" }, orderBy: { name: "asc" } }),
    getSettings(),
  ]);

  return (
    <div>
      <PageHeader title="New commission invoice" subtitle="Auto-numbered on save (COM/FY/NNN)" />
      <div className="px-8 pb-12">
        <SalesInvoiceForm
          clients={clients}
          creatorParties={creators}
          defaultTerms={settings.termsAndConditions}
          kind="commission"
        />
      </div>
    </div>
  );
}
