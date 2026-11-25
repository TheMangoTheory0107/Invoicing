import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import QuickAdd from "@/components/personal/QuickAdd";
import TrendChart from "@/components/personal/TrendChart";
import { SERIES } from "@/components/personal/types";
import { getCategories } from "@/lib/personal/categories";
import {
  buildInsights,
  currentMonthIST,
  getMonthSummary,
  getTrend,
  monthLabelLong,
  monthLabelShort,
  monthRange,
  nowIST,
  parseMonthParam,
  shiftMonth,
} from "@/lib/personal/summary";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default async function PersonalDashboard({ searchParams }: { searchParams: { month?: string } }) {
  const month = parseMonthParam(searchParams.month);
  const [s, trend, categories] = await Promise.all([getMonthSummary(month), getTrend(month, 6), getCategories()]);
  const isCurrent = month === currentMonthIST();
  const { end } = monthRange(month);
  const daysLeft = isCurrent ? Math.max(1, Math.round((end.getTime() - nowIST().getTime()) / 86400000)) : 0;
  const insights = buildInsights(s, trend, isCurrent, daysLeft);
  const maxCat = Math.max(1, ...s.categories.map((c) => c.amount));
  const spendBase = Math.max(1, s.spent);

  // Split bar is drawn against income if known, else against total outflow.
  const splitBase = Math.max(s.income, s.spent + s.invested, 1);
  const unspent = Math.max(0, s.income - s.spent - s.invested);
  const splitSegs = [
    { label: "Needs", value: s.needs, color: SERIES.needs },
    { label: "Wants", value: s.wants, color: SERIES.wants },
    { label: "Invested", value: Math.max(0, s.invested), color: SERIES.invested },
    { label: "Not spent yet", value: unspent, color: SERIES.unspent },
  ].filter((x) => x.value > 0);

  return (
    <div>
      <PageHeader
        title="My Money"
        subtitle="Personal expenses, investments and savings — month by month"
        actions={
          <>
            <Link href="/personal/import" className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark">
              Import bank statement
            </Link>
            <Link href="/personal/plan" className="rounded-md border border-slate-300 bg-white text-sm px-4 py-2 hover:bg-slate-50">
              Plan &amp; Salary
            </Link>
          </>
        }
      />
      <div className="px-8 py-6 space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <Link href={`/personal?month=${shiftMonth(month, -1)}`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            ←
          </Link>
          <div className="text-lg font-semibold text-slate-900 min-w-[160px] text-center">{monthLabelLong(month)}</div>
          <Link href={`/personal?month=${shiftMonth(month, 1)}`} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50">
            →
          </Link>
          {!isCurrent && (
            <Link href="/personal" className="text-sm text-brand hover:underline">
              This month
            </Link>
          )}
          <Link href={`/personal/transactions?month=${month}`} className="ml-auto text-sm text-brand hover:underline">
            All {s.txCount} transactions →
          </Link>
        </div>

        {/* Headline numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile
            label="Income"
            value={s.income > 0 ? inr(s.income) : "—"}
            sub={
              s.salarySource === "none"
                ? "Set your salary in Plan & Salary"
                : s.salarySource === "statement"
                ? "Salary credit from statement"
                : s.salarySource === "override"
                ? "Salary set for this month"
                : "Monthly salary from your plan"
            }
          />
          <Tile label="Spent" value={inr(s.spent)} sub={s.income > 0 ? `${Math.round((s.spent / s.income) * 100)}% of income` : `${s.categories.length} categories`} />
          <Tile label="Invested" value={inr(s.invested)} sub={`Target ${inr(s.targets.savings)} (${s.pct.savings}%)`} />
          <Tile
            label={s.income > 0 ? "Saved (invested + left)" : "Left over"}
            value={s.income > 0 ? inr(s.saved) : "—"}
            sub={s.income > 0 ? `${Math.round(s.savingsRate * 100)}% savings rate` : "Needs your salary"}
            tone={s.income > 0 ? (s.saved >= s.targets.savings ? "good" : "warn") : undefined}
          />
        </div>

        {s.unlabelledCount > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between">
            <span>
              <b>{s.unlabelledCount}</b> payments ({inr(s.unlabelled)}) still need a label.
            </span>
            <Link href={`/personal/transactions?month=${month}&filter=unlabelled`} className="font-medium underline">
              Label them now
            </Link>
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Split + budgets */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-5 space-y-5">
            <div>
              <div className="text-sm font-semibold text-slate-800">Your money split</div>
              <div className="text-xs text-slate-500">
                Target: {s.pct.needs}% needs · {s.pct.wants}% wants · {s.pct.savings}% savings
              </div>
            </div>
            {splitSegs.length > 0 ? (
              <div>
                <div className="flex h-6 w-full gap-[2px]">
                  {splitSegs.map((seg, i) => (
                    <div
                      key={seg.label}
                      title={`${seg.label}: ${inr(seg.value)}`}
                      className={`${i === 0 ? "rounded-l" : ""} ${i === splitSegs.length - 1 ? "rounded-r" : ""}`}
                      style={{ width: `${(seg.value / splitBase) * 100}%`, background: seg.color, minWidth: 3 }}
                    />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-slate-600">
                  {splitSegs.map((seg) => (
                    <span key={seg.label} className="flex items-center gap-1.5">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: seg.color }} />
                      {seg.label} <span className="text-slate-900 font-medium tabular-nums">{inr(seg.value)}</span>
                      <span className="text-slate-400">({Math.round((seg.value / splitBase) * 100)}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No transactions yet this month.</p>
            )}

            <div className="space-y-4 pt-1">
              <Meter label="Needs (essentials)" spent={s.needs} budget={s.targets.needs} color={SERIES.needs} hasIncome={s.income > 0} />
              <Meter
                label="Wants — your guilt-free / fun money"
                spent={s.wants}
                budget={s.targets.wants}
                color={SERIES.wants}
                hasIncome={s.income > 0}
                extra={
                  isCurrent && s.income > 0 && s.targets.wants > s.wants
                    ? `≈ ${inr((s.targets.wants - s.wants) / daysLeft)}/day for the next ${daysLeft} days`
                    : undefined
                }
              />
              <Meter label="Savings & investments" spent={s.invested} budget={s.targets.savings} color={SERIES.invested} hasIncome={s.income > 0} isGoal />
            </div>
          </div>

          {/* Insights */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-sm font-semibold text-slate-800 mb-3">What this means</div>
            <ul className="space-y-2.5 text-sm text-slate-700">
              {insights.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-brand mt-0.5">•</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Category breakdown */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-sm font-semibold text-slate-800">Where the money went</div>
            <div className="text-xs text-slate-500 mb-4">Share of {inr(s.spent)} spent (investments and transfers excluded)</div>
            {s.categories.length === 0 && <p className="text-sm text-slate-500">Nothing spent yet.</p>}
            <div className="space-y-2.5">
              {s.categories.map((c) => (
                <Link
                  key={c.id || "none"}
                  href={`/personal/transactions?month=${month}&${c.id ? `category=${c.id}` : "filter=unlabelled"}`}
                  className="grid grid-cols-[160px_1fr_110px] items-center gap-3 group"
                  title={`${c.count} transactions`}
                >
                  <span className="text-sm text-slate-700 truncate group-hover:text-brand">
                    {c.name}
                    <span className="ml-1.5 text-[10px] uppercase tracking-wide text-slate-400">{c.bucket === "NEEDS" ? "need" : "want"}</span>
                  </span>
                  <span className="h-3.5 bg-slate-100 rounded-r relative">
                    <span
                      className="absolute inset-y-0 left-0 rounded-r"
                      style={{
                        width: `${(c.amount / maxCat) * 100}%`,
                        background: c.id === null ? "#94a3b8" : c.bucket === "NEEDS" ? SERIES.needs : SERIES.wants,
                        minWidth: 2,
                      }}
                    />
                    {c.budget > 0 && (
                      <span className="absolute -top-1 -bottom-1 w-0.5 bg-slate-800" style={{ left: `${Math.min(100, (c.budget / maxCat) * 100)}%` }} title={`Cap ${inr(c.budget)}`} />
                    )}
                  </span>
                  <span className="text-sm text-right tabular-nums">
                    <span className="text-slate-900 font-medium">{inr(c.amount)}</span>{" "}
                    <span className="text-slate-400 text-xs">{Math.round((c.amount / spendBase) * 100)}%</span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Investments */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
            <div className="text-sm font-semibold text-slate-800">Investments</div>
            <div className="text-xs text-slate-500 mb-4">Counted as savings, not spending</div>
            {s.investments.length === 0 ? (
              <p className="text-sm text-slate-500">No investments recorded this month.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {s.investments.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2">
                        <Link href={`/personal/transactions?month=${month}&category=${c.id}`} className="hover:text-brand">
                          {c.name}
                        </Link>
                        <span className="text-xs text-slate-400 ml-1">×{c.count}</span>
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">{inr(c.amount)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="pt-2 text-slate-500">Total</td>
                    <td className="pt-2 text-right tabular-nums font-semibold">{inr(s.invested)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>

        <TrendChart
          points={trend.map((t) => ({
            month: t.month,
            label: monthLabelShort(t.month),
            needs: t.needs,
            wants: t.wants,
            invested: Math.max(0, t.invested),
            income: t.income,
          }))}
        />

        <QuickAdd categories={categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, bucket: c.bucket }))} />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "warn" }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-semibold text-slate-900 mt-1 tabular-nums">{value}</div>
      <div className={`text-xs mt-1 ${tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-slate-500"}`}>
        {tone === "good" ? "✓ " : tone === "warn" ? "▲ " : ""}
        {sub}
      </div>
    </div>
  );
}

function Meter({
  label,
  spent,
  budget,
  color,
  hasIncome,
  isGoal,
  extra,
}: {
  label: string;
  spent: number;
  budget: number;
  color: string;
  hasIncome: boolean;
  isGoal?: boolean;
  extra?: string;
}) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = budget > 0 && spent > budget;
  let status = "";
  if (hasIncome) {
    if (isGoal) status = spent >= budget ? "✓ Target met" : `${inr(budget - spent)} to go`;
    else status = over ? `▲ ${inr(spent - budget)} over` : `${inr(budget - spent)} left`;
  }
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1">
        <span className="text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-900">
          {inr(spent)}
          {hasIncome && <span className="text-slate-400"> / {inr(budget)}</span>}
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: hasIncome ? `${pct}%` : "0%", background: color }} />
      </div>
      <div className="flex justify-between text-xs mt-1">
        <span className={over && !isGoal ? "text-red-600 font-medium" : isGoal && spent >= budget ? "text-emerald-700" : "text-slate-500"}>
          {status || "Add your salary to see a budget"}
        </span>
        {extra && <span className="text-slate-500">{extra}</span>}
      </div>
    </div>
  );
}
