import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  companyName: z.string().min(1),
  addressLine1: z.string().default(""),
  addressLine2: z.string().default(""),
  addressLine3: z.string().default(""),
  sacCode: z.string().default(""),
  gstin: z.string().default(""),
  pan: z.string().default(""),
  bankAccName: z.string().default(""),
  bankName: z.string().default(""),
  bankAccNo: z.string().default(""),
  ifsc: z.string().default(""),
  upiId: z.string().default(""),
  termsAndConditions: z.string().default(""),
  paymentTermsDays: z.coerce.number().int().min(0).default(30),
  storagePath: z.string().min(1),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #134F5C")
    .default("#134F5C"),
  geminiApiKey: z.string().default(""),
  geminiModel: z.string().min(1).default("gemini-3.6-flash"),
});

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json(settings);
}
