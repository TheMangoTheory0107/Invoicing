import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayeeToken } from "@/lib/payeeConfirm";

export const dynamic = "force-dynamic";

// Public by design (see middleware.ts) — this is reached from a one-click link in an email, with
// no login. The signed token stands in for auth instead; a GET here would never mutate anything
// (some email clients pre-fetch links), so the actual confirm page's button POSTs to this route.
export async function POST(req: NextRequest) {
  const { partyId, token } = await req.json().catch(() => ({ partyId: "", token: "" }));
  if (!partyId || !token || !verifyPayeeToken(partyId, token)) {
    return NextResponse.json({ error: "This link is invalid or has expired." }, { status: 400 });
  }
  const party = await prisma.party.update({ where: { id: partyId }, data: { payeeAdded: true } }).catch(() => null);
  if (!party) {
    return NextResponse.json({ error: "Could not find that creator." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, name: party.name });
}
