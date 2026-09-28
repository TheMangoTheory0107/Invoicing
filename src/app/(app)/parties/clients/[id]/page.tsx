import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import PartyForm from "@/components/PartyForm";

export const dynamic = "force-dynamic";

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const party = await prisma.party.findUnique({ where: { id: params.id } });
  if (!party || party.type !== "CLIENT") notFound();

  return (
    <div>
      <PageHeader
        title={party.name}
        actions={
          <Link
            href={`/ledger/${party.id}`}
            className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50"
          >
            View ledger
          </Link>
        }
      />
      <div className="px-8 pb-12">
        <PartyForm type="CLIENT" party={party} listHref="/parties/clients" />
      </div>
    </div>
  );
}
