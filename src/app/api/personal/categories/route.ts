import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const CategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  kind: z.enum(["EXPENSE", "INVESTMENT", "INCOME", "TRANSFER"]),
  bucket: z.enum(["NEEDS", "WANTS"]).default("WANTS"),
  monthlyBudget: z.number().min(0).default(0),
});

export async function POST(req: NextRequest) {
  const parsed = CategorySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  const exists = await prisma.personalCategory.findUnique({ where: { name: parsed.data.name } });
  if (exists) return NextResponse.json({ error: "A category with that name already exists." }, { status: 400 });
  const max = await prisma.personalCategory.aggregate({ _max: { sortOrder: true } });
  const cat = await prisma.personalCategory.create({ data: { ...parsed.data, sortOrder: (max._max.sortOrder ?? 0) + 1 } });
  return NextResponse.json({ id: cat.id });
}
