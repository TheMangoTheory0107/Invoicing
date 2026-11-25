import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const PatchSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  kind: z.enum(["EXPENSE", "INVESTMENT", "INCOME", "TRANSFER"]).optional(),
  bucket: z.enum(["NEEDS", "WANTS"]).optional(),
  monthlyBudget: z.number().min(0).optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  try {
    await prisma.personalCategory.update({ where: { id: params.id }, data: parsed.data });
  } catch {
    return NextResponse.json({ error: "Couldn't save — is that name already used?" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
