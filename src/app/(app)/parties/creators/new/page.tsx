import PageHeader from "@/components/PageHeader";
import PartyForm from "@/components/PartyForm";

export default function NewCreatorPage() {
  return (
    <div>
      <PageHeader title="Add creator" />
      <div className="px-8 pb-12">
        <PartyForm type="CREATOR" listHref="/parties/creators" />
      </div>
    </div>
  );
}
