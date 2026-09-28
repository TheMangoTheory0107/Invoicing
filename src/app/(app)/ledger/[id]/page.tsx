import Link from "next/link";
import { notFound } from "next/navigation";
import { formatINR } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import PageHeader from "@/components/PageHeader";
import { fetchPartyLedger } from "@/lib/ledger";

export const dynamic = "force-dynamic";

const INVOICE_PATH: Record<string, string> = { SALES: "sales", PURCHASE: "purchase", COMMISSION: "commission" };

export default async function PartyLedgerPage({ params }: { params: { id: string } }) {
  const { party, rows, totals, outstanding } = await fetchPartyLedger(params.id).catch(() => {
    notFound();
  });

  const isClient = party.type === "CLIENT";
  const outstandingLabel = isClient ? "Receivable" : "Payable";
  const editHref = isClient ? `/parties/clients/${party.id}` : `/parties/creators/${party.id}`;

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
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Entry</th>
                <th className="text-right px-3 py-2">Invoiced</th>
                <th className="text-right px-3 py-2">Settled</th>
                <th className="text-right px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{formatDateDMY(r.date)}</td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/invoices/${INVOICE_PATH[r.invoiceType]}/${r.invoiceId}`}
                      className="text-brand hover:underline"
                    >
                      {r.label}
                    </Link>
                    {r.tdsAmount > 0 ? (
                      <span className="text-xs text-slate-400"> · incl. TDS {formatINR(r.tdsAmount)}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">{r.debit > 0 ? formatINR(r.debit) : ""}</td>
                  <td className="px-3 py-2 text-right">{r.credit > 0 ? formatINR(r.credit) : ""}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(r.balance)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No invoices yet.
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
