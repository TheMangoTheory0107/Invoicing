import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import QuickAdd from "@/components/personal/QuickAdd";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { getCategories } from "@/lib/personal/categories";
import { monthLabelLong, monthRange, parseMonthParam, shiftMonth } from "@/lib/personal/summary";
import TransactionsClient from "./transactions-client";

export const dynamic = "force-dynamic";

export default async function PersonalTransactionsPage({
  searchParams,
}: {
  searchParams: { month?: string; category?: string; filter?: string; q?: string };
}) {
  const month = parseMonthParam(searchParams.month);
  if (searchParams.category === "__unlabelled") {
    searchParams = { ...searchParams, category: undefined, filter: "unlabelled" };
  }
  const { start, end } = monthRange(month);
  const categories = await getCategories();
  const where = {
    date: { gte: start, lt: end },
    ...(searchParams.filter === "unlabelled" ? { categoryId: null } : searchParams.category ? { categoryId: searchParams.category } : {}),
  };
  const txs = await prisma.personalTransaction.findMany({ where, orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  const q = (searchParams.q || "").toLowerCase();
  const filtered = q ? txs.filter((t) => `${t.merchant} ${t.description} ${t.notes}`.toLowerCase().includes(q)) : txs;
  const catOptions = categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, bucket: c.bucket }));
  const qs = (m: string) => {
    const p = new URLSearchParams({ month: m });
    if (searchParams.category) p.set("category", searchParams.category);
    if (searchParams.filter) p.set("filter", searchParams.filter);
    return p.toString();
  };

  return (
    <div>
      <PageHeader
        title="Transactions"
        subtitle={monthLabelLong(month)}
        actions={
          <Link href="/personal/import" className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark">
            Import statement
          </Link>
        }
      />
      <div className="px-8 py-6 space-y-5 max-w-6xl">
        <QuickAdd categories={catOptions} />
        <form className="flex flex-wrap items-center gap-2" action="/personal/transactions">
          <Link href={`/personal/transactions?${qs(shiftMonth(month, -1))}`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            ←
          </Link>
          <input type="month" name="month" defaultValue={month} className="rounded-md border border-slate-300 px-2 py-1.5 text-sm" />
          <Link href={`/personal/transactions?${qs(shiftMonth(month, 1))}`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            →
          </Link>
          <select
            name="category"
            defaultValue={searchParams.filter === "unlabelled" ? "__unlabelled" : searchParams.category || ""}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            <option value="">All labels</option>
            <option value="__unlabelled">⚠ Unlabelled only</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input name="q" defaultValue={searchParams.q || ""} placeholder="Search…" className="rounded-md border border-slate-300 px-2 py-1.5 text-sm w-48" />
          <button className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">Filter</button>
        </form>
        <TransactionsClient
          categories={catOptions}
          transactions={filtered.map((t) => ({
            id: t.id,
            date: t.date.toISOString().slice(0, 10),
            description: t.description,
            merchant: t.merchant,
            amount: toNumber(t.amount),
            direction: t.direction as "DEBIT" | "CREDIT",
            categoryId: t.categoryId,
            notes: t.notes,
            source: t.source,
          }))}
        />
      </div>
    </div>
  );
}
