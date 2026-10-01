import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { testGmailAccess, GmailThreadError } from "@/lib/gmailThread";

export async function POST(req: NextRequest) {
  const { fromAddress } = await req.json().catch(() => ({ fromAddress: undefined }));
  if (!fromAddress || typeof fromAddress !== "string") {
    return NextResponse.json({ error: "Enter the from-address first." }, { status: 400 });
  }
  const driveConfig = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!driveConfig?.serviceAccountJson) {
    return NextResponse.json(
      { error: "No service account configured — set one up under Google Sheets & Drive sync first." },
      { status: 400 }
    );
  }

  try {
    await testGmailAccess(driveConfig.serviceAccountJson, fromAddress);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof GmailThreadError ? err.message : "Connection failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
