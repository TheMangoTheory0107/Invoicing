import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const PlanSchema = z
  .object({
    monthlySalary: z.number().min(0),
    needsPct: z.number().int().min(0).max(100),
    wantsPct: z.number().int().min(0).max(100),
    savingsPct: z.number().int().min(0).max(100),
  })
  .refine((p) => p.needsPct + p.wantsPct + p.savingsPct === 100, { message: "Needs + Wants + Savings must add up to 100%." });

export async function PUT(req: NextRequest) {
  const parsed = PlanSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid plan." }, { status: 400 });
  }
  await prisma.personalPlan.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
  return NextResponse.json({ ok: true });
}
