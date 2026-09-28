import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function GstFilingPage() {
  const fyRows = await prisma.invoice.findMany({ select: { fy: true }, distinct: ["fy"] });
  const fyOptions = fyRows.map((r) => r.fy).sort().reverse();
  const currentMonth = MONTHS[new Date().getMonth()];

  return (
    <div>
      <PageHeader
        title="GST Filing"
        subtitle="Export Sales, Commission & Purchase registers for one month — ready to send to your CA"
      />
      <div className="px-8 pb-12 max-w-lg">
        <form
          method="GET"
          action="/api/gst-filing/export"
          className="bg-white border border-slate-200 rounded-lg p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Financial year</span>
              <select
                name="fy"
                defaultValue={fyOptions[0] || ""}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              >
                {fyOptions.length === 0 && <option value="">No data yet</option>}
                {fyOptions.map((fy) => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-600 mb-1">Month</span>
              <select
                name="month"
                defaultValue={currentMonth}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                required
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="submit"
            disabled={fyOptions.length === 0}
            className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark disabled:opacity-60"
          >
            Download filing pack (.xlsx)
          </button>
          <p className="text-xs text-slate-400">
            One workbook, three tabs: Sales Register, Commission Register, Purchase Register — all
            invoices dated in that month, with GST, amount paid, TDS deducted, and balance.
          </p>
        </form>
      </div>
    </div>
  );
}
