import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function CreatorsPage() {
  const creators = await prisma.party.findMany({
    where: { type: "CREATOR" },
    orderBy: { name: "asc" },
    include: { _count: { select: { purchaseInvoices: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Creators"
        subtitle="Who you pay out via Purchase bills"
        actions={
          <Link
            href="/parties/creators/new"
            className="rounded-md bg-brand text-white text-sm font-medium px-4 py-2 hover:bg-brand-dark"
          >
            + Add creator
          </Link>
        }
      />
      <div className="px-8 pb-12">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Page handle</th>
                <th className="text-left px-4 py-2">GSTIN</th>
                <th className="text-left px-4 py-2">Phone</th>
                <th className="text-right px-4 py-2">Bills</th>
              </tr>
            </thead>
            <tbody>
              {creators.map((c) => (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/parties/creators/${c.id}`} className="text-brand hover:underline font-medium">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-500">{c.pageHandle || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{c.gstin || "—"}</td>
                  <td className="px-4 py-2 text-slate-500">{c.phone || "—"}</td>
                  <td className="px-4 py-2 text-right">{c._count.purchaseInvoices}</td>
                </tr>
              ))}
              {creators.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    No creators yet.
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
