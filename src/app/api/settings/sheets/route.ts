import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  spreadsheetId: z.string().default(""),
  salesSheetName: z.string().min(1),
  purchaseSheetName: z.string().min(1),
  commissionSheetName: z.string().min(1),
  serviceAccountJson: z.string().default(""),
  enabled: z.boolean().default(false),
  driveFolderId: z.string().default(""),
});

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const config = await prisma.sheetSyncConfig.upsert({
    where: { id: 1 },
    create: { id: 1, ...parsed.data },
    update: parsed.data,
  });
  return NextResponse.json(config);
}
