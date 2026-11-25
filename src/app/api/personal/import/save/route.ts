import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { learnRules } from "@/lib/personal/rules";

const RowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string(),
  merchant: z.string(),
  merchantKey: z.string(),
  amount: z.number().positive(),
  direction: z.enum(["DEBIT", "CREDIT"]),
  categoryId: z.string().nullable(),
  notes: z.string().default(""),
  importHash: z.string(),
  remember: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const parsed = z.object({ rows: z.array(RowSchema) }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid rows." }, { status: 400 });
  const { rows } = parsed.data;

  const existing = await prisma.personalTransaction.findMany({
    where: { importHash: { in: rows.map((r) => r.importHash) } },
    select: { importHash: true },
  });
  const skip = new Set(existing.map((e) => e.importHash));
  const fresh = rows.filter((r) => !skip.has(r.importHash));

  await prisma.$transaction(
    fresh.map((r) =>
      prisma.personalTransaction.create({
        data: {
          date: new Date(`${r.date}T00:00:00.000Z`),
          description: r.description,
          merchant: r.merchant,
          amount: r.amount,
          direction: r.direction,
          categoryId: r.categoryId,
          notes: r.notes,
          source: "STATEMENT",
          importHash: r.importHash,
        },
      })
    )
  );

  const learned = await learnRules(
    rows.filter((r) => r.remember && r.categoryId && r.merchantKey).map((r) => ({ key: r.merchantKey, categoryId: r.categoryId! }))
  );

  return NextResponse.json({ saved: fresh.length, skipped: rows.length - fresh.length, learned });
}
