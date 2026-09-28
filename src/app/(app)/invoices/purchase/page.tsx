import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR, toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ClickableRow from "@/components/ClickableRow";
import StopClickPropagation from "@/components/StopClickPropagation";
import SortControl from "@/components/SortControl";
import { displayStatus } from "@/lib/status";
import { invoiceOrderBy } from "@/lib/sortOrder";

export const dynamic = "force-dynamic";

const MONTH_ORDER = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

export default async function PurchaseInvoicesPage({
  searchParams,
}: {
  searchParams: { sort?: string };
}) {
  const sort = searchParams.sort;
  const isNumberSort = sort === "number-asc" || sort === "number-desc";
  const invoices = await prisma.invoice.findMany({
    where: { type: "PURCHASE" },
    include: { creator: true },
    orderBy: invoiceOrderBy(sort),
  });

  // A number sort flattens the usual month grouping — sorting cleanly by number and grouping
  // by month at the same time isn't a coherent combination, so the sort wins.
  const groups = new Map<string, typeof invoices>();
  if (!isNumberSort) {
    for (const inv of invoices) {
      const key = `${inv.fy} · ${inv.month}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(inv);
    }
  }
  const sortedGroupKeys = Array.from(groups.keys()).sort((a, b) => {
    const [fyA, monthA] = a.split(" · ");
    const [fyB, monthB] = b.split(" · ");
    if (fyA !== fyB) return fyB.localeCompare(fyA);
    return MONTH_ORDER.indexOf(monthB) - MONTH_ORDER.indexOf(monthA);
  });

  const row = (inv: (typeof invoices)[number]) => (
    <ClickableRow key={inv.id} href={`/invoices/purchase/${inv.id}`} className="border-t border-slate-100 hover:bg-slate-50">
      <td className="px-4 py-2">
        <Link href={`/invoices/purchase/${inv.id}`} className="text-brand hover:underline font-medium">
          {inv.vendorInvoiceNumber || inv.number}
        </Link>
        {inv.vendorInvoiceNumber && (
          <span className="text-xs text-slate-400 ml-1.5">({inv.number})</span>
        )}
      </td>
      <td className="px-4 py-2 text-slate-500">{inv.date.toISOString().slice(0, 10)}</td>
      <td className="px-4 py-2">{inv.creator?.name || "—"}</td>
      <td className="px-4 py-2 text-right">{formatINR(toNumber(inv.totalAmount))}</td>
      <td className="px-4 py-2">
        <StatusBadge
          status={displayStatus(
            inv.status,
            inv.dueDate,
            toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted),
            toNumber(inv.totalAmount)
          )}
        />
      </td>
      <td className="px-4 py-2">
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
  );

  return (
    <div>
      <PageHeader
        title="Purchase Bills"
        subtitle="Amounts you owe creators"
        actions={
          <>
            <Link
              href="/invoices/purchase/upload"
              className="rounded-md border border-brand text-brand text-sm font-medium px-4 py-2 hover:bg-brand-light"
            >
              Upload bills
            </Link>
            <Link
              href="/invoices/purchase/new"
              className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark"
            >
              + New bill
            </Link>
          </>
        }
      />
      <div className="px-8 pb-12 space-y-6">
        <div className="flex justify-end">
          <SortControl />
        </div>
        {isNumberSort ? (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2">Invoice number</th>
                  <th className="text-left px-4 py-2">Date</th>
                  <th className="text-left px-4 py-2">Creator</th>
                  <th className="text-right px-4 py-2">Total</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">File</th>
                </tr>
              </thead>
              <tbody>{invoices.map(row)}</tbody>
            </table>
          </div>
        ) : (
          sortedGroupKeys.map((key) => (
            <div key={key}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{key}</h2>
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Invoice number</th>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Creator</th>
                      <th className="text-right px-4 py-2">Total</th>
                      <th className="text-left px-4 py-2">Status</th>
                      <th className="text-left px-4 py-2">File</th>
                    </tr>
                  </thead>
                  <tbody>{groups.get(key)!.map(row)}</tbody>
                </table>
              </div>
            </div>
          ))
        )}
        {invoices.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-8 text-center text-slate-400">
            No purchase bills yet.
          </div>
        )}
      </div>
    </div>
  );
}
