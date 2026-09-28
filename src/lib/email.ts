import nodemailer from "nodemailer";

export class EmailSendError extends Error {}

function getTransport(fromAddress: string, appPassword: string) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: fromAddress, pass: appPassword },
  });
}

// A from-address + app password pair is all Gmail SMTP needs — no OAuth, no Workspace admin
// console changes. Generated at myaccount.google.com/apppasswords (needs 2-Step Verification
// on first).
export async function testEmailConnection(fromAddress: string, appPassword: string): Promise<void> {
  if (!fromAddress || !appPassword) {
    throw new EmailSendError("Enter both the from-address and the app password first.");
  }
  const transport = getTransport(fromAddress, appPassword);
  try {
    await transport.verify();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new EmailSendError(
      `Could not sign in to Gmail with those details. Make sure 2-Step Verification is on for ${fromAddress} and you're using an App Password (16 characters, from myaccount.google.com/apppasswords), not the regular account password. (${message})`
    );
  }
}

export interface InvoiceEmailParams {
  fromAddress: string;
  appPassword: string;
  fromName: string;
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer };
}

export async function sendInvoiceEmail(params: InvoiceEmailParams): Promise<void> {
  const { fromAddress, appPassword, fromName, to, subject, html, attachment } = params;
  if (!fromAddress || !appPassword) {
    throw new EmailSendError("No sending email configured — add one in Settings → Email first.");
  }
  const transport = getTransport(fromAddress, appPassword);
  try {
    await transport.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html,
      attachments: [{ filename: attachment.filename, content: attachment.content }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new EmailSendError(`Could not send the email. (${message})`);
  }
}
