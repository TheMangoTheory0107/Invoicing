import Link from "next/link";
import { formatINR, toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ReconciliationFilters from "@/components/ReconciliationFilters";
import { displayStatus } from "@/lib/status";
import { fetchReconciliationRows, type ReconciliationFilters as Filters } from "@/lib/reconciliation";

export const dynamic = "force-dynamic";

export default async function ReconciliationPage({ searchParams }: { searchParams: Filters }) {
  const invoices = await fetchReconciliationRows(searchParams);

  const totals = invoices.reduce(
    (acc, inv) => {
      const total = toNumber(inv.totalAmount);
      const paid = toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted);
      const balance = total - paid;
      if (inv.type === "PURCHASE") {
        acc.purchaseTotal += total;
        acc.payableBalance += balance;
      } else {
        // SALES and COMMISSION are both money owed TO you, billed to a client — same side.
        acc.salesTotal += total;
        acc.receivableBalance += balance;
      }
      return acc;
    },
    { salesTotal: 0, purchaseTotal: 0, receivableBalance: 0, payableBalance: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Reconciliation"
        subtitle="Cross-check invoices against your books and bank statements"
      />
      <div className="px-8">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Sales + Commission total (period)" value={formatINR(totals.salesTotal)} />
          <SummaryCard label="Purchase total (period)" value={formatINR(totals.purchaseTotal)} />
          <SummaryCard label="Receivable balance" value={formatINR(totals.receivableBalance)} tone="emerald" />
          <SummaryCard label="Payable balance" value={formatINR(totals.payableBalance)} tone="amber" />
        </div>
      </div>
      <div className="px-8 pb-12">
        <ReconciliationFilters />
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Number</th>
                <th className="text-left px-3 py-2">Party</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-right px-3 py-2">Paid</th>
                <th className="text-right px-3 py-2">Balance</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const total = toNumber(inv.totalAmount);
                const paid = toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted);
                return (
                  <tr key={inv.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{formatDateDMY(inv.date)}</td>
                    <td className="px-3 py-2">
                      {inv.type === "SALES" ? "Sales" : inv.type === "COMMISSION" ? "Commission" : "Purchase"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/invoices/${inv.type === "SALES" ? "sales" : inv.type === "COMMISSION" ? "commission" : "purchase"}/${inv.id}`}
                        className="text-brand hover:underline font-medium"
                      >
                        {inv.number}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{inv.client?.name || inv.creator?.name || "—"}</td>
                    <td className="px-3 py-2 text-right">{formatINR(total)}</td>
                    <td className="px-3 py-2 text-right">{formatINR(paid)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatINR(total - paid)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge status={displayStatus(inv.status, inv.dueDate, paid, total)} />
                    </td>
                  </tr>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No matching records.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-600" : tone === "amber" ? "text-amber-600" : "text-slate-800";
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
