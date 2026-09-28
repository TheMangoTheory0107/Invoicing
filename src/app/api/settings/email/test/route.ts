import { NextRequest, NextResponse } from "next/server";
import { testEmailConnection, EmailSendError } from "@/lib/email";

export async function POST(req: NextRequest) {
  const { fromAddress, appPassword } = await req.json();
  try {
    await testEmailConnection(fromAddress, appPassword);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof EmailSendError ? err.message : "Connection failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
