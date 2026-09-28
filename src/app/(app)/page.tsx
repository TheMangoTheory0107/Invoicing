import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { toNumber, formatINR } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import { startOfTodayUTC, displayStatus } from "@/lib/status";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ClickableRow from "@/components/ClickableRow";
import DashboardFilters from "@/components/DashboardFilters";
import { fetchBusinessOverview, fetchDashboardInvoices, type DashboardFilters as Filters } from "@/lib/dashboardQuery";

export const dynamic = "force-dynamic";

const MONTH_OPTIONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

async function getOpenBalances() {
  const [salesOpen, purchaseOpen, overdueSales, overduePurchase] = await Promise.all([
    prisma.invoice.findMany({
      where: { type: { in: ["SALES", "COMMISSION"] }, status: { not: "PAID" } },
      select: { totalAmount: true, amountPaid: true },
    }),
    prisma.invoice.findMany({
      where: { type: "PURCHASE", status: { not: "PAID" } },
      select: { totalAmount: true, amountPaid: true },
    }),
    prisma.invoice.findMany({
      where: {
        type: { in: ["SALES", "COMMISSION"] },
        status: { not: "PAID" },
        dueDate: { lt: startOfTodayUTC() },
      },
      include: { client: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.invoice.findMany({
      where: {
        type: "PURCHASE",
        status: { not: "PAID" },
        dueDate: { lt: startOfTodayUTC() },
      },
      include: { creator: true },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
  ]);

  const receivable = salesOpen.reduce(
    (sum, i) => sum + (toNumber(i.totalAmount) - toNumber(i.amountPaid)),
    0
  );
  const payable = purchaseOpen.reduce(
    (sum, i) => sum + (toNumber(i.totalAmount) - toNumber(i.amountPaid)),
    0
  );

  return { receivable, payable, overdueSales, overduePurchase };
}

function typeLabel(type: string) {
  return type === "SALES" ? "Sales" : type === "COMMISSION" ? "Commission" : "Purchase";
}

function invoiceHref(inv: { id: string; type: string }) {
  const base = inv.type === "SALES" ? "sales" : inv.type === "COMMISSION" ? "commission" : "purchase";
  return `/invoices/${base}/${inv.id}`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Filters }) {
  const [{ receivable, payable, overdueSales, overduePurchase }, overview, invoices, fyRows] =
    await Promise.all([
      getOpenBalances(),
      fetchBusinessOverview(searchParams),
      fetchDashboardInvoices(searchParams),
      prisma.invoice.findMany({ select: { fy: true }, distinct: ["fy"] }),
    ]);

  const fyOptions = fyRows.map((r) => r.fy).sort().reverse();
  const periodLabel = [searchParams.month, searchParams.fy ? `FY ${searchParams.fy}` : null]
    .filter(Boolean)
    .join(" · ") || "all time";

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of receivables, payables and recent activity" />
      <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Outstanding receivable" value={formatINR(receivable)} tone="brand" icon="in" />
        <StatCard label="Outstanding payable" value={formatINR(payable)} tone="amber" icon="out" />
        <StatCard label="Overdue sales & commission" value={String(overdueSales.length)} tone="red" icon="alert" />
        <StatCard label="Overdue purchase bills" value={String(overduePurchase.length)} tone="red" icon="alert" />
      </div>

      <div className="px-8 mt-8">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Business overview <span className="text-slate-400 font-normal">({periodLabel})</span>
          </h2>
          <DashboardFilters fyOptions={fyOptions} monthOptions={MONTH_OPTIONS} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Turnover (Sales + Commission)"
            value={formatINR(overview.turnover)}
            tone="brand"
            icon="in"
          />
          <StatCard label="Purchase costs" value={formatINR(overview.costs)} tone="amber" icon="out" />
          <StatCard
            label="Profit"
            value={formatINR(overview.profit)}
            sub={`${overview.profit >= 0 ? "+" : ""}${overview.profitMargin.toFixed(1)}% margin`}
            tone={overview.profit >= 0 ? "green" : "red"}
            icon="profit"
          />
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Turnover and costs are pre-GST invoice amounts — GST collected/paid isn&apos;t real revenue
          or cost, so it&apos;s left out to keep this figure accurate.
        </p>
      </div>

      <div className="px-8 mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OverdueList
          title="Overdue — Sales & Commission (money owed to you)"
          items={overdueSales.map((i) => ({
            id: i.id,
            number: i.number,
            party: i.client?.name || "—",
            amount: toNumber(i.totalAmount) - toNumber(i.amountPaid),
            dueDate: i.dueDate,
            type: i.type,
          }))}
        />
        <OverdueList
          title="Overdue — Purchase (money you owe)"
          items={overduePurchase.map((i) => ({
            id: i.id,
            number: i.vendorInvoiceNumber || i.number,
            party: i.creator?.name || "—",
            amount: toNumber(i.totalAmount) - toNumber(i.amountPaid),
            dueDate: i.dueDate,
            type: i.type,
          }))}
        />
      </div>

      <div className="px-8 mt-8 pb-12">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Invoices <span className="text-slate-400 font-normal">({periodLabel})</span>
        </h2>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2.5">Number</th>
                <th className="text-left px-4 py-2.5">Type</th>
                <th className="text-left px-4 py-2.5">Party</th>
                <th className="text-left px-4 py-2.5">Date</th>
                <th className="text-right px-4 py-2.5">Total</th>
                <th className="text-left px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const total = toNumber(inv.totalAmount);
                const paid = toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted);
                return (
                  <ClickableRow
                    key={inv.id}
                    href={invoiceHref(inv)}
                    className="border-t border-slate-100 hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <Link href={invoiceHref(inv)} className="text-brand hover:underline font-medium">
                        {inv.type === "PURCHASE" ? inv.vendorInvoiceNumber || inv.number : inv.number}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{typeLabel(inv.type)}</td>
                    <td className="px-4 py-2.5">{inv.client?.name || inv.creator?.name || "—"}</td>
                    <td className="px-4 py-2.5">{formatDateDMY(inv.date)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{formatINR(total)}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={displayStatus(inv.status, inv.dueDate, paid, total)} />
                    </td>
                  </ClickableRow>
                );
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No invoices for this period.{" "}
                    <Link href="/invoices/sales/new" className="text-brand hover:underline">
                      Create your first sales invoice
                    </Link>
                    .
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

const ICONS: Record<string, React.ReactNode> = {
  in: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0 0l-5-5m5 5l5-5" />
  ),
  out: (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 0l-5 5m5-5l5 5" />
  ),
  alert: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  ),
  profit: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"
    />
  ),
};

function StatCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone: "brand" | "amber" | "red" | "green";
  icon: keyof typeof ICONS;
}) {
  const toneClass = {
    brand: { text: "text-brand", bg: "bg-brand-light" },
    amber: { text: "text-amber-600", bg: "bg-amber-50" },
    red: { text: "text-red-600", bg: "bg-red-50" },
    green: { text: "text-emerald-600", bg: "bg-emerald-50" },
  }[tone];
  return (
    <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm flex items-start gap-3.5">
      <div className={`shrink-0 rounded-lg p-2.5 ${toneClass.bg} ${toneClass.text}`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-5 h-5">
          {ICONS[icon]}
        </svg>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 truncate">{label}</div>
        <div className={`text-2xl font-semibold mt-0.5 ${toneClass.text}`}>{value}</div>
        {sub && <div className={`text-xs mt-0.5 ${toneClass.text}`}>{sub}</div>}
      </div>
    </div>
  );
}

function OverdueList({
  title,
  items,
}: {
  title: string;
  items: { id: string; number: string; party: string; amount: number; dueDate: Date | null; type: string }[];
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
      <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-700">
        {title}
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 text-sm text-slate-400 text-center">Nothing overdue 🎉</div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id} className="px-4 py-2.5 flex items-center justify-between text-sm">
              <div>
                <Link href={invoiceHref(item)} className="text-brand hover:underline font-medium">
                  {item.number}
                </Link>
                <div className="text-slate-500 text-xs">{item.party}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">{formatINR(item.amount)}</div>
                {item.dueDate && (
                  <div className="text-xs text-red-500">
                    due {item.dueDate.toISOString().slice(0, 10)}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
