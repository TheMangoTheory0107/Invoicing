import PageHeader from "@/components/PageHeader";
import PartyForm from "@/components/PartyForm";

export default function NewClientPage() {
  return (
    <div>
      <PageHeader title="Add client / agency" />
      <div className="px-8 pb-12">
        <PartyForm type="CLIENT" listHref="/parties/clients" />
      </div>
    </div>
  );
}
