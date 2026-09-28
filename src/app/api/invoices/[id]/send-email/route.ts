import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { buildInvoicePdfData } from "@/lib/invoiceService";
import { renderInvoicePdf } from "@/lib/pdf/generate";
import { sendInvoiceEmail, EmailSendError } from "@/lib/email";
import { buildInvoiceEmailHtml } from "@/lib/emailTemplate";
import { toNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

// Emails a Sales or Commission invoice — generates the same PDF Download would, attaches it,
// and sends from the address configured in Settings. Purchase bills aren't sent this way; the
// vendor already has their own copy, we're the recipient there, not the sender.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { to } = await req.json();
  if (!to || typeof to !== "string" || !to.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address to send to." }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id }, include: { client: true } });
  if (!invoice || invoice.type === "PURCHASE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const settings = await getSettings();
  if (!settings.emailFromAddress || !settings.emailAppPassword) {
    return NextResponse.json(
      { error: "No sending email configured — add one in Settings → Email invoices first." },
      { status: 400 }
    );
  }

  try {
    const pdfData = await buildInvoicePdfData(invoice.id);
    const pdfBuffer = await renderInvoicePdf(pdfData);
    const balance = toNumber(invoice.totalAmount) - toNumber(invoice.amountPaid) - toNumber(invoice.tdsDeducted);
    const invoiceLabel = invoice.type === "COMMISSION" ? "Commission invoice" : "Invoice";

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

    await sendInvoiceEmail({
      fromAddress: settings.emailFromAddress,
      appPassword: settings.emailAppPassword,
      fromName: settings.companyName,
      to,
      subject: `${invoiceLabel} ${invoice.number} from ${settings.companyName}`,
      html,
      attachment: { filename: `${invoice.number.replace(/\//g, "-")}.pdf`, content: pdfBuffer },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof EmailSendError ? err.message : "Could not send the email.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
