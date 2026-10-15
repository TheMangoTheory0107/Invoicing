import Link from "next/link";
import { formatINR } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import LedgerIndexFilters from "@/components/LedgerIndexFilters";
import { fetchAllPartyBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function LedgerIndexPage({
  searchParams,
}: {
  searchParams: { q?: string; sort?: string };
}) {
  const balances = await fetchAllPartyBalances();

  // The two summary cards above always reflect everyone — only the lists below narrow down.
  const receivableAll = balances.filter((b) => b.type === "CLIENT").reduce((s, c) => s + Math.max(0, c.outstanding), 0);
  const payableAll = balances.filter((b) => b.type === "CREATOR").reduce((s, c) => s + Math.max(0, c.outstanding), 0);

  let filtered = balances;
  if (searchParams.q) {
    const q = searchParams.q.toLowerCase();
    filtered = filtered.filter((b) => b.name.toLowerCase().includes(q));
  }
  filtered = [...filtered].sort((a, b) => {
    if (searchParams.sort === "name") return a.name.localeCompare(b.name);
    if (searchParams.sort === "outstanding-asc") return a.outstanding - b.outstanding;
    return b.outstanding - a.outstanding;
  });

  const clients = filtered.filter((b) => b.type === "CLIENT");
  const creators = filtered.filter((b) => b.type === "CREATOR");

  return (
    <div>
      <PageHeader title="Ledgers" subtitle="Debtors and creditors — outstanding balance per party" />
      <div className="px-8">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SummaryCard label="Total receivable (clients owe you)" value={formatINR(receivableAll)} tone="emerald" />
          <SummaryCard label="Total payable (you owe creators)" value={formatINR(payableAll)} tone="amber" />
        </div>
      </div>
      <div className="px-8">
        <LedgerIndexFilters />
      </div>
      <div className="px-8 pb-12 grid grid-cols-2 gap-6">
        <LedgerTable title="Clients / Agencies" rows={clients} basePath="/ledger" />
        <LedgerTable title="Creators" rows={creators} basePath="/ledger" />
      </div>
    </div>
  );
}

function LedgerTable({
  title,
  rows,
  basePath,
}: {
  title: string;
  rows: { id: string; name: string; invoiced: number; outstanding: number }[];
  basePath: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase bg-slate-50">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-400 uppercase">
          <tr>
            <th className="text-left px-4 py-2">Name</th>
            <th className="text-right px-4 py-2">Invoiced</th>
            <th className="text-right px-4 py-2">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-2">
                <Link href={`${basePath}/${r.id}`} className="text-brand hover:underline font-medium">
                  {r.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-right text-slate-500">{formatINR(r.invoiced)}</td>
              <td className={`px-4 py-2 text-right font-medium ${r.outstanding > 0.01 ? "text-amber-600" : "text-slate-400"}`}>
                {formatINR(r.outstanding)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                Nothing invoiced yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" }) {
  const toneClass = tone === "emerald" ? "text-emerald-600" : "text-amber-600";
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-5 py-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-xl font-semibold mt-1 ${toneClass}`}>{value}</div>
    </div>
  );
}
