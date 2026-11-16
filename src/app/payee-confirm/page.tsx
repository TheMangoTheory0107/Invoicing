import { prisma } from "@/lib/prisma";
import { verifyPayeeToken } from "@/lib/payeeConfirm";
import PayeeConfirmClient from "./payee-confirm-client";

export const dynamic = "force-dynamic";

// Public page (see middleware.ts) reached from a one-click email link — the signed token in the
// URL stands in for login, since this is meant to work straight from an inbox.
export default async function PayeeConfirmPage({
  searchParams,
}: {
  searchParams: { party?: string; token?: string };
}) {
  const partyId = searchParams.party || "";
  const token = searchParams.token || "";
  const valid = !!partyId && !!token && verifyPayeeToken(partyId, token);
  const party = valid ? await prisma.party.findUnique({ where: { id: partyId } }) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="mb-6">
          <div className="text-2xl font-bold text-[#134F5C]">THE MANGO THEORY</div>
          <div className="text-sm text-slate-500 mt-1">Invoicing</div>
        </div>
        {!valid || !party ? (
          <p className="text-sm text-red-600">This link is invalid or has expired.</p>
        ) : (
          <PayeeConfirmClient partyId={party.id} token={token} name={party.name} alreadyDone={party.payeeAdded} />
        )}
      </div>
    </div>
  );
}
