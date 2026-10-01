import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildInvoicePdfData } from "@/lib/invoiceService";
import { renderInvoicePdf } from "@/lib/pdf/generate";
import { sendInvoiceEmail, EmailSendError } from "@/lib/email";
import { sendInThreadOrFresh, GmailThreadError } from "@/lib/gmailThread";
import { buildInvoiceEmailHtml } from "@/lib/emailTemplate";
import { toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

// Emails a Sales or Commission invoice — generates the same PDF Download would, attaches it,
// and sends from the address configured in Settings. Purchase bills aren't sent this way; the
// vendor already has their own copy, we're the recipient there, not the sender.
//
// `subject` is optional. Left blank, it sends a normal new email via Gmail SMTP (App Password).
// Filled in, it instead searches the mailbox (via the Sheets/Drive service account, once a
// Workspace admin has granted it Gmail domain-wide delegation) for the most recent thread with
// that exact subject, and replies into it with real threading headers — not a new email Gmail
// merely groups by guesswork. If that search/send fails for any reason (delegation not granted
// yet, no matching thread, etc.), it automatically falls back to a plain new email instead of
// blocking the send, and says so in the response.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { to, subject } = await req.json();
  if (!to || typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address to send to." }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!invoice || invoice.type === "PURCHASE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getSettings();
  if (!settings.emailFromAddress) {
    return NextResponse.json(
      { error: "No sending email address configured — add one in Settings → Email invoices first." },
      { status: 400 }
    );
  }

  try {
    const pdfData = await buildInvoicePdfData(invoice.id);
    const pdfBuffer = await renderInvoicePdf(pdfData);
    const balance = toNumber(invoice.totalAmount) - toNumber(invoice.amountPaid) - toNumber(invoice.tdsDeducted);
    const invoiceLabel = invoice.type === "COMMISSION" ? "Commission invoice" : "Invoice";
    const emailSubject =
      typeof subject === "string" && subject.trim()
        ? subject.trim()
        : `${invoiceLabel} ${invoice.number} from ${settings.companyName}`;
    const wantsThreadMatch = typeof subject === "string" && subject.trim().length > 0;

    const html = buildInvoiceEmailHtml({
      companyName: settings.companyName,
      brandColor: settings.brandColor,
      clientName: invoice.client?.name || "",
      invoiceLabel,
      invoiceNumber: invoice.number,
      invoiceDate: invoice.date,
      dueDate: invoice.dueDate,
      totalAmount: toNumber(invoice.totalAmount),
      balance,
    });

    const attachment = { filename: `${invoice.number.replace(/\//g, "-")}.pdf`, content: pdfBuffer };

    let threaded = false;
    let fallbackReason: string | undefined;

    if (wantsThreadMatch) {
      const driveConfig = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
      if (!driveConfig?.serviceAccountJson) {
        fallbackReason =
          "No service account configured — set one up in Settings → Google Sheets & Drive sync first, then grant it Gmail access.";
      } else {
        try {
          const result = await sendInThreadOrFresh({
            serviceAccountJson: driveConfig.serviceAccountJson,
            impersonate: settings.emailFromAddress,
            fromName: settings.companyName,
            to,
            subject: emailSubject,
            html,
            attachment,
          });
          threaded = result.threaded;
          if (!threaded) fallbackReason = "No existing email thread matched that subject — sent as a new email instead.";
        } catch (err) {
          fallbackReason = err instanceof GmailThreadError ? err.message : "Could not search the mailbox for a matching thread.";
        }
      }
    }

    // Either thread-matching wasn't requested, or it was and failed — either way, a plain
    // email still needs to go out via the App Password path, same as before this feature.
    if (!wantsThreadMatch || !threaded) {
      if (!settings.emailAppPassword) {
        return NextResponse.json(
          {
            error: fallbackReason
              ? `${fallbackReason} And no App Password is set in Settings to fall back to.`
              : "No App Password configured — add one in Settings → Email invoices first.",
          },
          { status: 400 }
        );
      }
      await sendInvoiceEmail({
        fromAddress: settings.emailFromAddress,
        appPassword: settings.emailAppPassword,
        fromName: settings.companyName,
        to,
        subject: emailSubject,
        html,
        attachment,
      });
    }

    return NextResponse.json({ ok: true, threaded, warning: wantsThreadMatch ? fallbackReason : undefined });
  } catch (err) {
    const message = err instanceof EmailSendError ? err.message : "Could not send the email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
