import Link from "next/link";
import { formatINR } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import { fetchAllPartyBalances } from "@/lib/ledger";

export const dynamic = "force-dynamic";

export default async function LedgerIndexPage() {
  const balances = await fetchAllPartyBalances();
  const clients = balances.filter((b) => b.type === "CLIENT");
  const creators = balances.filter((b) => b.type === "CREATOR");

  const receivable = clients.reduce((s, c) => s + Math.max(0, c.outstanding), 0);
  const payable = creators.reduce((s, c) => s + Math.max(0, c.outstanding), 0);

  return (
    <div>
      <PageHeader title="Ledgers" subtitle="Debtors and creditors — outstanding balance per party" />
      <div className="px-8">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <SummaryCard label="Total receivable (clients owe you)" value={formatINR(receivable)} tone="emerald" />
          <SummaryCard label="Total payable (you owe creators)" value={formatINR(payable)} tone="amber" />
        </div>
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
