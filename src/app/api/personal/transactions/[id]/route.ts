import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { merchantKey } from "@/lib/personal/categorize";
import { learnRules } from "@/lib/personal/rules";

const PatchSchema = z.object({
  categoryId: z.string().nullable().optional(),
  notes: z.string().optional(),
  description: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  direction: z.enum(["DEBIT", "CREDIT"]).optional(),
  // Also remember this merchant → category, and label every other still-unlabelled
  // transaction from the same merchant.
  applyToMerchant: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const parsed = PatchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const { applyToMerchant, date, ...rest } = parsed.data;

  const tx = await prisma.personalTransaction.update({
    where: { id: params.id },
    data: { ...rest, ...(date ? { date: new Date(`${date}T00:00:00.000Z`) } : {}) },
  });

  let alsoUpdated = 0;
  if (applyToMerchant && tx.categoryId && tx.merchant) {
    const key = merchantKey(tx.merchant);
    await learnRules([{ key, categoryId: tx.categoryId }]);
    const unlabelled = await prisma.personalTransaction.findMany({
      where: { categoryId: null, NOT: { id: tx.id } },
      select: { id: true, merchant: true },
    });
    const ids = unlabelled.filter((u) => merchantKey(u.merchant) === key).map((u) => u.id);
    if (ids.length) {
      const res = await prisma.personalTransaction.updateMany({ where: { id: { in: ids } }, data: { categoryId: tx.categoryId } });
      alsoUpdated = res.count;
    }
  }
  return NextResponse.json({ ok: true, alsoUpdated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.personalTransaction.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
