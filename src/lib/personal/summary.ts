import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { getCategories, getPlan } from "./categories";

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m - 1 + delta, 1)));
}

export function monthLabelLong(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function monthLabelShort(month: string) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export interface CategoryTotal {
  id: string | null;
  name: string;
  kind: string;
  bucket: string;
  amount: number;
  count: number;
  budget: number;
}

export interface MonthSummary {
  month: string;
  salary: number;
  salarySource: "override" | "statement" | "plan" | "none";
  otherIncome: number;
  income: number;
  needs: number;
  wants: number;
  unlabelled: number; // debits with no category — counted inside `wants` too, flagged separately
  unlabelledCount: number;
  spent: number; // needs + wants
  invested: number;
  leftover: number; // income - spent - invested
  saved: number; // invested + leftover (what didn't get spent)
  savingsRate: number; // saved / income
  targets: { needs: number; wants: number; savings: number };
  pct: { needs: number; wants: number; savings: number };
  categories: CategoryTotal[]; // expense categories, largest first
  investments: CategoryTotal[];
  txCount: number;
}

export async function getMonthSummary(month: string): Promise<MonthSummary> {
  const [plan, categories, override] = await Promise.all([
    getPlan(),
    getCategories(true),
    prisma.personalMonthIncome.findUnique({ where: { month } }),
  ]);
  const { start, end } = monthRange(month);
  const txs = await prisma.personalTransaction.findMany({
    where: { date: { gte: start, lt: end } },
    select: { amount: true, direction: true, categoryId: true },
  });
  const catById = new Map(categories.map((c) => [c.id, c]));

  const totals = new Map<string, CategoryTotal>();
  let salaryFromTx = 0;
  let otherIncome = 0;
  let unlabelled = 0;
  let unlabelledCount = 0;

  for (const tx of txs) {
    const amt = toNumber(tx.amount);
    const signed = tx.direction === "DEBIT" ? amt : -amt; // + = money out
    const cat = tx.categoryId ? catById.get(tx.categoryId) : undefined;
    if (!cat) {
      if (tx.direction === "DEBIT") {
        unlabelled += amt;
        unlabelledCount++;
      }
      continue; // unlabelled credits are ignored until you label them
    }
    if (cat.kind === "TRANSFER") continue;
    if (cat.kind === "INCOME") {
      if (cat.name === "Salary") salaryFromTx -= signed;
      else otherIncome -= signed;
      continue;
    }
    // EXPENSE / INVESTMENT — a credit into one of these is a refund/redemption, netted off.
    const t = totals.get(cat.id) || {
      id: cat.id,
      name: cat.name,
      kind: cat.kind,
      bucket: cat.bucket,
      amount: 0,
      count: 0,
      budget: toNumber(cat.monthlyBudget),
    };
    t.amount += signed;
    t.count++;
    totals.set(cat.id, t);
  }

  let salary = 0;
  let salarySource: MonthSummary["salarySource"] = "none";
  if (override) {
    salary = toNumber(override.salary);
    salarySource = "override";
  } else if (salaryFromTx > 0) {
    salary = salaryFromTx;
    salarySource = "statement";
  } else if (toNumber(plan.monthlySalary) > 0) {
    salary = toNumber(plan.monthlySalary);
    salarySource = "plan";
  }
  const income = salary + Math.max(0, otherIncome);

  const all = Array.from(totals.values());
  const expenseCats = all.filter((t) => t.kind === "EXPENSE");
  if (unlabelled > 0) {
    expenseCats.push({ id: null, name: "Unlabelled", kind: "EXPENSE", bucket: "WANTS", amount: unlabelled, count: unlabelledCount, budget: 0 });
  }
  expenseCats.sort((a, b) => b.amount - a.amount);
  const investments = all.filter((t) => t.kind === "INVESTMENT").sort((a, b) => b.amount - a.amount);

  const needs = expenseCats.filter((c) => c.bucket === "NEEDS").reduce((s, c) => s + c.amount, 0);
  const wants = expenseCats.filter((c) => c.bucket !== "NEEDS").reduce((s, c) => s + c.amount, 0);
  const invested = investments.reduce((s, c) => s + c.amount, 0);
  const spent = needs + wants;
  const leftover = income - spent - invested;
  const saved = invested + leftover;

  return {
    month,
    salary,
    salarySource,
    otherIncome: Math.max(0, otherIncome),
    income,
    needs,
    wants,
    unlabelled,
    unlabelledCount,
    spent,
    invested,
    leftover,
    saved,
    savingsRate: income > 0 ? saved / income : 0,
    targets: {
      needs: (income * plan.needsPct) / 100,
      wants: (income * plan.wantsPct) / 100,
      savings: (income * plan.savingsPct) / 100,
    },
    pct: { needs: plan.needsPct, wants: plan.wantsPct, savings: plan.savingsPct },
    categories: expenseCats,
    investments,
    txCount: txs.length,
  };
}

export async function getTrend(endMonth: string, months = 6) {
  const list = Array.from({ length: months }, (_, i) => shiftMonth(endMonth, i - (months - 1)));
  const all = await Promise.all(list.map((m) => getMonthSummary(m)));
  // Months before you started tracking would otherwise show a full salary with nothing spent —
  // blank them out so the chart (and "emergency fund" average) only reflects real data.
  return all.map((s) => (s.txCount === 0 && s.salarySource === "plan" ? { ...s, income: 0, salary: 0, leftover: 0, saved: 0 } : s));
}

// Plain-language nudges for the dashboard, derived from the month's numbers.
export function buildInsights(s: MonthSummary, trend: MonthSummary[], isCurrentMonth: boolean, daysLeft: number): string[] {
  const out: string[] = [];
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  if (s.income <= 0) {
    out.push("Add your monthly salary in Plan & Salary so I can work out your savings target and fun-money budget.");
  }
  if (s.unlabelledCount > 0) {
    out.push(`${s.unlabelledCount} payments (${inr(s.unlabelled)}) are still unlabelled — label them so the split below is accurate.`);
  }
  if (s.income > 0) {
    const funLeft = s.targets.wants - s.wants;
    if (funLeft >= 0) {
      out.push(
        isCurrentMonth && daysLeft > 0
          ? `You have ${inr(funLeft)} of guilt-free "wants" money left this month — about ${inr(funLeft / daysLeft)}/day for the remaining ${daysLeft} days.`
          : `You stayed ${inr(funLeft)} under your wants budget.`
      );
    } else {
      out.push(`Wants spending is ${inr(-funLeft)} over the ${s.pct.wants}% budget (${inr(s.targets.wants)}).`);
    }
    if (s.needs > s.targets.needs) {
      out.push(`Needs are ${Math.round((s.needs / s.income) * 100)}% of income vs a ${s.pct.needs}% target — worth checking the fixed costs.`);
    }
    if (s.invested < s.targets.savings) {
      out.push(`To hit your ${s.pct.savings}% savings target, invest ${inr(s.targets.savings - s.invested)} more this month (target ${inr(s.targets.savings)}).`);
    } else {
      out.push(`You've invested ${inr(s.invested)} — ${s.pct.savings}% target of ${inr(s.targets.savings)} met. 🎉`);
    }
  }
  const top = s.categories.find((c) => c.id !== null);
  if (top && s.spent > 0) {
    out.push(`Biggest spend: ${top.name} at ${inr(top.amount)} (${Math.round((top.amount / s.spent) * 100)}% of spending).`);
  }
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  if (prev && prev.spent > 0 && s.spent > 0 && !isCurrentMonth) {
    const delta = (s.spent - prev.spent) / prev.spent;
    out.push(`Spending is ${delta >= 0 ? "up" : "down"} ${Math.abs(Math.round(delta * 100))}% vs last month.`);
  }
  for (const c of s.categories) {
    if (c.budget > 0 && c.amount > c.budget) out.push(`${c.name} crossed its ${inr(c.budget)} cap by ${inr(c.amount - c.budget)}.`);
  }
  const needsMonths = trend.filter((t) => t.needs > 0);
  if (needsMonths.length) {
    const avgNeeds = needsMonths.reduce((a, t) => a + t.needs, 0) / needsMonths.length;
    out.push(`Emergency fund goal: ${inr(avgNeeds * 6)} (6 months of your average needs of ${inr(avgNeeds)}).`);
  }
  return out;
}

export function nowIST() {
  return new Date(Date.now() + 5.5 * 3600 * 1000);
}

export function currentMonthIST() {
  return monthKey(nowIST());
}

export function parseMonthParam(v: string | string[] | undefined) {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : currentMonthIST();
}
