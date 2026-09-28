import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { partySchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type");
  const parties = await prisma.party.findMany({
    where: type ? { type } : undefined,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(parties);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = partySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const party = await prisma.party.create({ data: parsed.data });
  return NextResponse.json(party, { status: 201 });
}
