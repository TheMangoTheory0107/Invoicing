import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatINR, toNumber } from "@/lib/format";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import ClickableRow from "@/components/ClickableRow";
import StopClickPropagation from "@/components/StopClickPropagation";
import { displayStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default async function CommissionInvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    where: { type: "COMMISSION" },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader
        title="Commission Invoices"
        subtitle="Commission invoices you raise to clients / agencies"
        actions={
          <Link
            href="/invoices/commission/new"
            className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark"
          >
            + New invoice
          </Link>
        }
      />
      <div className="px-8 pb-12">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Number</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-right px-4 py-2">Total</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">File</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <ClickableRow key={inv.id} href={`/invoices/commission/${inv.id}`} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/invoices/commission/${inv.id}`} className="text-brand hover:underline font-medium">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{inv.date.toISOString().slice(0, 10)}</td>
                  <td className="px-4 py-2">{inv.client?.name || "—"}</td>
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
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                    No commission invoices yet.
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
