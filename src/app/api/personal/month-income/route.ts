import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Set (or clear, with salary: null) a one-off salary for a specific month.
export async function PUT(req: NextRequest) {
  const parsed = z
    .object({ month: z.string().regex(/^\d{4}-\d{2}$/), salary: z.number().min(0).nullable() })
    .safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid month/salary." }, { status: 400 });
  const { month, salary } = parsed.data;
  if (salary === null) {
    await prisma.personalMonthIncome.deleteMany({ where: { month } });
  } else {
    await prisma.personalMonthIncome.upsert({ where: { month }, create: { month, salary }, update: { salary } });
  }
  return NextResponse.json({ ok: true });
}
