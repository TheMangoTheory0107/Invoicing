import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR, toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import RegisterFilters from "@/components/RegisterFilters";
import ClickableRow from "@/components/ClickableRow";
import StopClickPropagation from "@/components/StopClickPropagation";
import { displayStatus } from "@/lib/status";
import { buildInvoiceWhere } from "@/lib/registerQuery";
import { invoiceOrderBy } from "@/lib/sortOrder";

export const dynamic = "force-dynamic";

export default async function PurchaseRegisterPage({
  searchParams,
}: {
  searchParams: { fy?: string; month?: string; status?: string; q?: string; sort?: string };
}) {
  const [fyRows, invoices] = await Promise.all([
    prisma.invoice.findMany({ where: { type: "PURCHASE" }, select: { fy: true }, distinct: ["fy"] }),
    prisma.invoice.findMany({
      where: buildInvoiceWhere("PURCHASE", searchParams, "creator"),
      include: { creator: true },
      orderBy: invoiceOrderBy(searchParams.sort),
    }),
  ]);

  const fyOptions = fyRows.map((r) => r.fy).sort().reverse();
  const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const totals = invoices.filter((inv) => inv.status !== "CANCELLED").reduce(
    (acc, inv) => {
      acc.total += toNumber(inv.totalAmount);
      acc.paid += toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted);
      return acc;
    },
    { total: 0, paid: 0 }
  );

  return (
    <div>
      <PageHeader title="Purchase Register" subtitle="Every purchase bill — same columns your CA expects" />
      <div className="px-8 pb-12">
        <RegisterFilters fyOptions={fyOptions} monthOptions={monthOptions} />
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Month</th>
                <th className="text-left px-3 py-2">Invoice sent date</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-left px-3 py-2">Invoice number</th>
                <th className="text-right px-3 py-2">Amount</th>
                <th className="text-right px-3 py-2">Balance</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">File</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <ClickableRow key={inv.id} href={`/invoices/purchase/${inv.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{inv.month}</td>
                  <td className="px-3 py-2">{formatDateDMY(inv.date)}</td>
                  <td className="px-3 py-2">{inv.creator?.name || "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/invoices/purchase/${inv.id}`} className="text-brand hover:underline font-medium">
                      {inv.vendorInvoiceNumber || inv.number}
                    </Link>
                    {inv.vendorInvoiceNumber && (
                      <span className="text-xs text-slate-400 ml-1.5">({inv.number})</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">{formatINR(toNumber(inv.totalAmount))}</td>
                  <td className="px-3 py-2 text-right">
                    {formatINR(
                      toNumber(inv.totalAmount) - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted)
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge
                      status={displayStatus(
                        inv.status,
                        inv.dueDate,
                        toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted),
                        toNumber(inv.totalAmount)
                      )}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {inv.pdfPath ? (
                      <StopClickPropagation>
                        <a
                          href={inv.pdfPath}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand hover:underline text-xs font-medium"
                        >
                          Drive ↗
                        </a>
                      </StopClickPropagation>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </ClickableRow>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                    No matching bills.
                  </td>
                </tr>
              )}
            </tbody>
            {invoices.length > 0 && (
              <tfoot className="bg-slate-50 font-medium border-t border-slate-200">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right text-slate-500">
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(totals.total)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(totals.total - totals.paid)}</td>
                  <td></td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
