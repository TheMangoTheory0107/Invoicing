import Link from "next/link";
import { formatINR, toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import PageHeader from "@/components/PageHeader";
import PaymentsLogFilters from "@/components/PaymentsLogFilters";
import ClickableRow from "@/components/ClickableRow";
import { fetchPaymentsLog, type PaymentsLogFilters as Filters } from "@/lib/paymentsLog";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  SALES: "Sales",
  COMMISSION: "Commission",
  PURCHASE: "Purchase",
};

export default async function PaymentsLogPage({ searchParams }: { searchParams: Filters }) {
  const payments = await fetchPaymentsLog(searchParams);

  const totals = payments.reduce(
    (acc, p) => {
      acc.received += toNumber(p.amount);
      acc.tds += toNumber(p.tdsAmount);
      return acc;
    },
    { received: 0, tds: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Payments"
        subtitle="Every payment transaction across all invoices, newest first"
      />
      <div className="px-8">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SummaryCard label="Total received (period)" value={formatINR(totals.received)} tone="emerald" />
          <SummaryCard label="Total TDS withheld (period)" value={formatINR(totals.tds)} tone="amber" />
        </div>
      </div>
      <div className="px-8 pb-12">
        <PaymentsLogFilters />
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-left px-3 py-2">Party</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-right px-3 py-2">TDS</th>
                <th className="text-left px-3 py-2">Method</th>
                <th className="text-left px-3 py-2">Reference</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const inv = p.invoice;
                const listBase = inv.type === "SALES" ? "sales" : inv.type === "COMMISSION" ? "commission" : "purchase";
                const displayNumber = inv.type === "PURCHASE" ? inv.vendorInvoiceNumber || inv.number : inv.number;
                return (
                  <ClickableRow key={p.id} href={`/invoices/${listBase}/${inv.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{formatDateDMY(p.date)}</td>
                    <td className="px-3 py-2">{TYPE_LABEL[inv.type] || inv.type}</td>
                    <td className="px-3 py-2">
                      <Link href={`/invoices/${listBase}/${inv.id}`} className="text-brand hover:underline font-medium">
                        {displayNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{inv.client?.name || inv.creator?.name || "—"}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatINR(toNumber(p.amount))}</td>
                    <td className="px-3 py-2 text-right">
                      {toNumber(p.tdsAmount) > 0 ? formatINR(toNumber(p.tdsAmount)) : "—"}
                    </td>
                    <td className="px-3 py-2">{p.method || "—"}</td>
                    <td className="px-3 py-2">{p.reference || "—"}</td>
                  </ClickableRow>
                );
              })}
              {payments.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No matching payments.
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
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
