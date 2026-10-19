import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import LedgerEntryFilters from "@/components/LedgerEntryFilters";
import { fetchPartyLedger, TYPE_LABEL } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const INVOICE_PATH: Record<string, string> = { SALES: "sales", PURCHASE: "purchase", COMMISSION: "commission" };
const MONTH_OPTIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function PartyLedgerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { fy?: string; month?: string; status?: string; q?: string; sort?: string };
}) {
  const { party, rows: allRows, totals, outstanding } = await fetchPartyLedger(params.id).catch(() => {
    notFound();
  });

  const isClient = party.type === "CLIENT";
  const outstandingLabel = isClient ? "Receivable" : "Payable";
  const editHref = isClient ? `/parties/clients/${party.id}` : `/parties/creators/${party.id}`;

  // The totals/outstanding cards above always stay lifetime figures — only which invoices are
  // listed below changes. Each row's own balance (invoiced minus settled, for that invoice
  // only) never changes with filtering either.
  const fyOptions = Array.from(new Set(allRows.map((r) => r.fy))).sort().reverse();
  let rows = allRows;
  if (searchParams.fy) rows = rows.filter((r) => r.fy === searchParams.fy);
  if (searchParams.month) rows = rows.filter((r) => r.month === searchParams.month);
  if (searchParams.status === "OVERDUE") rows = rows.filter((r) => r.status === "OVERDUE");
  else if (searchParams.status) rows = rows.filter((r) => r.status === searchParams.status);
  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    rows = rows.filter((r) => r.invoiceNumber.toLowerCase().includes(q));
  }
  rows = [...rows].sort((a, b) =>
    searchParams.sort === "newest" ? b.date.getTime() - a.date.getTime() : a.date.getTime() - b.date.getTime()
  );

  return (
    <div>
      <PageHeader
        title={party.name}
        subtitle={isClient ? "Client ledger" : "Creator ledger"}
        actions={
          <Link href={editHref} className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50">
            Edit party
          </Link>
        }
      />
      <div className="px-8">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Total invoiced" value={formatINR(totals.invoiced)} />
          <SummaryCard label="Cash received" value={formatINR(totals.received)} />
          <SummaryCard label="TDS deducted" value={formatINR(totals.tds)} />
          <SummaryCard
            label={outstandingLabel}
            value={formatINR(Math.max(0, outstanding))}
            tone={outstanding > 0.01 ? "amber" : "emerald"}
          />
        </div>
      </div>
      <div className="px-8 pb-12">
        <LedgerEntryFilters fyOptions={fyOptions} monthOptions={MONTH_OPTIONS} />
        {rows.length !== allRows.length && (
          <p className="text-xs text-slate-400 mb-2">
            Showing {rows.length} of {allRows.length} invoices.
          </p>
        )}
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-right px-3 py-2">Invoiced</th>
                <th className="text-right px-3 py-2">Settled</th>
                <th className="text-right px-3 py-2">Balance</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoiceId} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{formatDateDMY(r.date)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/invoices/${INVOICE_PATH[r.invoiceType]}/${r.invoiceId}`}
                      className="text-brand hover:underline"
                    >
                      {TYPE_LABEL[r.invoiceType] || r.invoiceType} {r.invoiceNumber}
                    </Link>
                    {r.paymentCount > 0 ? (
                      <span className="text-xs text-slate-400">
                        {" "}
                        · {r.paymentCount} payment{r.paymentCount > 1 ? "s" : ""}
                        {r.tdsAmount > 0 ? `, incl. TDS ${formatINR(r.tdsAmount)}` : ""}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(r.invoiced)}</td>
                  <td className="px-3 py-2 text-right">{r.settled > 0 ? formatINR(r.settled) : ""}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(Math.max(0, r.balance))}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    {allRows.length === 0 ? "No invoices yet." : "No invoices match these filters."}
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
