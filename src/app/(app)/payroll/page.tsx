import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR, toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function PayrollPage() {
  const employees = await prisma.employee.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { payments: { orderBy: { date: "desc" } } },
  });

  const rows = employees.map((e) => {
    const totalPaid = e.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return {
      id: e.id,
      name: e.name,
      monthlySalary: toNumber(e.monthlySalary),
      active: e.active,
      totalPaid,
      lastPaidDate: e.payments[0]?.date ?? null,
      paymentCount: e.payments.length,
    };
  });

  const monthlyTotal = rows.filter((r) => r.active).reduce((s, r) => s + r.monthlySalary, 0);

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="How much each employee's been paid, and when"
        actions={
          <Link
            href="/payroll/new"
            className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark"
          >
            + Add employee
          </Link>
        }
      />
      <div className="px-8 pt-6">
        <div className="bg-white border border-slate-200 rounded-lg px-5 py-4 inline-block">
          <div className="text-xs text-slate-500">Total monthly salary (active employees)</div>
          <div className="text-xl font-semibold mt-1 text-slate-800">{formatINR(monthlyTotal)}</div>
        </div>
      </div>
      <div className="px-8 pb-12 pt-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-right px-4 py-2">Monthly Salary</th>
                <th className="text-right px-4 py-2">Total Paid</th>
                <th className="text-left px-4 py-2">Last Paid</th>
                <th className="text-left px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/payroll/${r.id}`} className="text-brand hover:underline font-medium">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-right">{formatINR(r.monthlySalary)}</td>
                  <td className="px-4 py-2 text-right">{formatINR(r.totalPaid)}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {r.lastPaidDate ? formatDateDMY(r.lastPaidDate) : "—"}
                  </td>
                  <td className="px-4 py-2">
                    {r.active ? (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-200 text-slate-700">
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No employees yet.{" "}
                    <Link href="/payroll/new" className="text-brand hover:underline">
                      Add your first employee
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
