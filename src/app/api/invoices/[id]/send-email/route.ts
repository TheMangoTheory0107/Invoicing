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
// Email and Subject are either/or, not both required:
// - Subject blank → needs an email address; sends a normal new email via the App Password.
// - Subject filled in → the email address doesn't matter and can be left blank. It searches
//   the mailbox (via the Sheets/Drive service account, once a Workspace admin has granted it
//   Gmail domain-wide delegation) for the most recent thread with that exact subject, and
//   replies into it addressed to whoever's actually on the other end of that thread — not
//   whatever was typed in. The email address is only used as a fallback if no thread matches.
// If the thread search/send fails for any reason (delegation not granted yet, no address to
// fall back to, etc.), it surfaces a clear error instead of silently doing nothing.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { to, subject } = await req.json();
  const trimmedTo = typeof to === "string" ? to.trim() : "";
  const trimmedSubject = typeof subject === "string" ? subject.trim() : "";

  if (trimmedTo && !trimmedTo.includes("@")) {
    return NextResponse.json({ error: "That doesn't look like a valid email address." }, { status: 400 });
  }
  if (!trimmedTo && !trimmedSubject) {
    return NextResponse.json(
      { error: "Enter an email address, a subject to match an existing thread, or both." },
      { status: 400 }
    );
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
    const emailSubject = trimmedSubject || `${invoiceLabel} ${invoice.number} from ${settings.companyName}`;
    const wantsThreadMatch = !!trimmedSubject;

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
    let resolvedTo = trimmedTo || undefined;
    let resolvedCc: string | undefined;
    let sentViaGmailApi = false;
    let note: string | undefined;

    if (wantsThreadMatch) {
      const driveConfig = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
      if (!driveConfig?.serviceAccountJson) {
        note = "No service account configured — set one up in Settings → Google Sheets & Drive sync first, then grant it Gmail access.";
      } else {
        try {
          const result = await sendInThreadOrFresh({
            serviceAccountJson: driveConfig.serviceAccountJson,
            impersonate: settings.emailFromAddress,
            fromName: settings.companyName,
            to: trimmedTo || undefined,
            subject: emailSubject,
            html,
            attachment,
          });
          threaded = result.threaded;
          resolvedTo = result.to;
          resolvedCc = result.cc;
          sentViaGmailApi = true;
          if (!threaded) note = "No existing email thread matched that subject — sent as a new email instead.";
        } catch (err) {
          note = err instanceof GmailThreadError ? err.message : "Could not search or send via the Gmail API.";
        }
      }
    }

    // Either no Subject was given at all, or the Gmail API path above threw — either way,
    // nothing has actually been sent yet, so fall back to a plain email via the App Password.
    if (!sentViaGmailApi) {
      const fallbackTo = resolvedTo || trimmedTo;
      if (!fallbackTo) {
        return NextResponse.json(
          { error: `${note ? note + " " : ""}No email address was given to send to.` },
          { status: 400 }
        );
      }
      if (!settings.emailAppPassword) {
        return NextResponse.json(
          { error: `${note ? note + " " : ""}No App Password configured in Settings to fall back to.` },
          { status: 400 }
        );
      }
      await sendInvoiceEmail({
        fromAddress: settings.emailFromAddress,
        appPassword: settings.emailAppPassword,
        fromName: settings.companyName,
        to: fallbackTo,
        subject: emailSubject,
        html,
        attachment,
      });
      resolvedTo = fallbackTo;
    }

    return NextResponse.json({ ok: true, threaded, to: resolvedTo, cc: resolvedCc, warning: note });
  } catch (err) {
    const message = err instanceof EmailSendError ? err.message : "Could not send the email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
