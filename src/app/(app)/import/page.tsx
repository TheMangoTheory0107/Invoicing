import PageHeader from "@/components/PageHeader";
import ImportForm from "./import-form";

export default function ImportPage() {
  return (
    <div>
      <PageHeader
        title="Import historical data"
        subtitle="Bring in your existing Sales / Purchase Register so everything lives in one place"
      />
      <div className="px-8 pb-12 max-w-2xl space-y-6">
        <ImportForm
          type="CLIENTS"
          title="Import Clients / Agencies"
          columns={["Name", "GST", "Address"]}
          optionalColumns={["Agency (short code)"]}
        />
        <ImportForm
          type="SALES"
          title="Import Sales Register"
          columns={["Month", "Date", "Agency", "GST No.", "Bill no", "Bill Amount", "GST", "Total Amount"]}
          optionalColumns={["Amount Paid", "Receipt Date", "TDS", "Brand", "Due Date", "Status"]}
        />
        <ImportForm
          type="PURCHASE"
          title="Import Purchase Register"
          columns={["Month", "Invoice sent date", "Name", "Invoice number", "Amount"]}
          optionalColumns={["Amount Paid", "Paid Date", "GST", "Reimbursements", "Due Date", "Status"]}
        />
        <p className="text-xs text-slate-400">
          Rows are matched by client/creator name — new parties are created automatically when no
          exact name match exists. Rows whose Bill no / Invoice number already exists are skipped,
          so you can safely re-upload the same file. Amount Paid + Receipt/Paid Date create a real
          payment record dated correctly, so the dashboard and reconciliation views reflect it.
          Auto-numbering for new invoices is advanced past the highest imported number in each
          financial year. Import Clients first if you have a separate agency list, so Sales rows
          pick up their GST/address automatically.
        </p>
      </div>
    </div>
  );
}
