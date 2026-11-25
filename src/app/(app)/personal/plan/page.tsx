import PageHeader from "@/components/PageHeader";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { getCategories, getPlan } from "@/lib/personal/categories";
import { currentMonthIST } from "@/lib/personal/summary";
import PlanClient from "./plan-client";

export const dynamic = "force-dynamic";

export default async function PersonalPlanPage() {
  const [plan, categories, overrides] = await Promise.all([
    getPlan(),
    getCategories(true),
    prisma.personalMonthIncome.findMany({ orderBy: { month: "desc" }, take: 24 }),
  ]);
  return (
    <div>
      <PageHeader title="Plan & Salary" subtitle="Your salary, how you want to split it, and your labels" />
      <div className="px-8 py-6 max-w-5xl">
        <PlanClient
          plan={{ monthlySalary: toNumber(plan.monthlySalary), needsPct: plan.needsPct, wantsPct: plan.wantsPct, savingsPct: plan.savingsPct }}
          overrides={overrides.map((o) => ({ month: o.month, salary: toNumber(o.salary) }))}
          currentMonth={currentMonthIST()}
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            kind: c.kind,
            bucket: c.bucket,
            monthlyBudget: toNumber(c.monthlyBudget),
            archived: c.archived,
          }))}
        />
      </div>
    </div>
  );
}
