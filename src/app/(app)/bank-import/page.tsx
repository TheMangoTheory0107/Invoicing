import PageHeader from "@/components/PageHeader";
import BankImportClient from "./bank-import-client";

export default function BankImportPage() {
  return (
    <div>
      <PageHeader
        title="Bank Import"
        subtitle="Upload a bank statement to auto-match incoming/outgoing payments against open invoices"
      />
      <div className="px-8 pb-12">
        <BankImportClient />
      </div>
    </div>
  );
}
