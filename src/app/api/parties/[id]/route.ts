import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { partySchema } from "@/lib/validation";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const party = await prisma.party.findUnique({ where: { id: params.id } });
  if (!party) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(party);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = partySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const party = await prisma.party.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(party);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const usageCount = await prisma.invoice.count({
    where: { OR: [{ clientId: params.id }, { creatorId: params.id }] },
  });
  if (usageCount > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${usageCount} invoice(s) reference this party.` },
      { status: 400 }
    );
  }
  await prisma.party.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
