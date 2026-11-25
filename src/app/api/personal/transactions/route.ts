import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractMerchant } from "@/lib/personal/categorize";

const CreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1, "Add a short description"),
  amount: z.number().positive("Amount must be more than 0"),
  direction: z.enum(["DEBIT", "CREDIT"]).default("DEBIT"),
  categoryId: z.string().nullable(),
  notes: z.string().default(""),
});

// Manual day-to-day entry.
export async function POST(req: NextRequest) {
  const parsed = CreateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid entry." }, { status: 400 });
  }
  const d = parsed.data;
  const tx = await prisma.personalTransaction.create({
    data: {
      date: new Date(`${d.date}T00:00:00.000Z`),
      description: d.description,
      merchant: extractMerchant(d.description),
      amount: d.amount,
      direction: d.direction,
      categoryId: d.categoryId,
      notes: d.notes,
      source: "MANUAL",
    },
  });
  return NextResponse.json({ id: tx.id });
}
