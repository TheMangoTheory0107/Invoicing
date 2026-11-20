import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { buildFullBackupXlsxBuffer } from "@/lib/backup";
import { sendInvoiceEmail, EmailSendError } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron hits this weekly (see vercel.json) — same Bearer-token auth as the other cron
// route. Emails the full backup workbook to the business's own inbox, so there's always an
// offline copy sitting somewhere other than Turso/Vercel, with zero setup beyond the email
// already configured in Settings.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings();
  if (!settings.emailFromAddress || !settings.emailAppPassword) {
    return NextResponse.json({ attempted: false, ok: true, reason: "No sending email configured in Settings." });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  try {
    const buffer = await buildFullBackupXlsxBuffer();
    await sendInvoiceEmail({
      fromAddress: settings.emailFromAddress,
      appPassword: settings.emailAppPassword,
      fromName: settings.companyName,
      to: settings.emailFromAddress,
      subject: `Weekly data backup — ${stamp}`,
      html: `<p>Your weekly automatic backup is attached — every client, creator, invoice, and payment as one Excel file.</p>`,
      attachment: { filename: `mango-theory-backup-${stamp}.xlsx`, content: buffer },
    });
    return NextResponse.json({ attempted: true, ok: true });
  } catch (err) {
    const message = err instanceof EmailSendError ? err.message : err instanceof Error ? err.message : "Could not send the backup email.";
    return NextResponse.json({ attempted: true, ok: false, error: message }, { status: 500 });
  }
}
