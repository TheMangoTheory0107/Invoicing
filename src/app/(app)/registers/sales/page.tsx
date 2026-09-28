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

export default async function SalesRegisterPage({
  searchParams,
}: {
  searchParams: { fy?: string; month?: string; status?: string; q?: string; sort?: string };
}) {
  const [fyRows, invoices] = await Promise.all([
    prisma.invoice.findMany({ where: { type: "SALES" }, select: { fy: true }, distinct: ["fy"] }),
    prisma.invoice.findMany({
      where: buildInvoiceWhere("SALES", searchParams, "client"),
      include: { client: true },
      orderBy: invoiceOrderBy(searchParams.sort),
    }),
  ]);

  const fyOptions = fyRows.map((r) => r.fy).sort().reverse();
  const monthOptions = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const totals = invoices.reduce(
    (acc, inv) => {
      acc.bill += toNumber(inv.billAmount);
      acc.gst += toNumber(inv.gstAmount);
      acc.total += toNumber(inv.totalAmount);
      acc.paid += toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted);
      return acc;
    },
    { bill: 0, gst: 0, total: 0, paid: 0 }
  );

  return (
    <div>
      <PageHeader title="Sales Register" subtitle="Every sales invoice — same columns your CA expects" />
      <div className="px-8 pb-12">
        <RegisterFilters fyOptions={fyOptions} monthOptions={monthOptions} />
        <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-3 py-2">Month</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Agency</th>
                <th className="text-left px-3 py-2">GST No.</th>
                <th className="text-left px-3 py-2">Bill No</th>
                <th className="text-right px-3 py-2">Bill Amount</th>
                <th className="text-right px-3 py-2">GST</th>
                <th className="text-right px-3 py-2">Total Amount</th>
                <th className="text-right px-3 py-2">Balance</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">File</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <ClickableRow key={inv.id} href={`/invoices/sales/${inv.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{inv.month}</td>
                  <td className="px-3 py-2">{formatDateDMY(inv.date)}</td>
                  <td className="px-3 py-2">{inv.client?.name || "—"}</td>
                  <td className="px-3 py-2 text-slate-500">{inv.client?.gstin || "—"}</td>
                  <td className="px-3 py-2">
                    <Link href={`/invoices/sales/${inv.id}`} className="text-brand hover:underline font-medium">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(toNumber(inv.billAmount))}</td>
                  <td className="px-3 py-2 text-right">{formatINR(toNumber(inv.gstAmount))}</td>
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
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    No matching invoices.
                  </td>
                </tr>
              )}
            </tbody>
            {invoices.length > 0 && (
              <tfoot className="bg-slate-50 font-medium border-t border-slate-200">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right text-slate-500">
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right">{formatINR(totals.bill)}</td>
                  <td className="px-3 py-2 text-right">{formatINR(totals.gst)}</td>
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
