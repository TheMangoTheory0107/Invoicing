import { google } from "googleapis";
import MailComposer from "nodemailer/lib/mail-composer";

export class GmailThreadError extends Error {}

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];

function parseServiceAccount(json: string) {
  try {
    return JSON.parse(json) as { client_email: string; private_key: string };
  } catch {
    throw new GmailThreadError("The service account key isn't valid JSON.");
  }
}

// Impersonates the invoicing mailbox via the same service account already used for
// Sheets/Drive — this only works once a Workspace admin grants that service account
// domain-wide delegation for the two Gmail scopes above.
function getGmailClient(serviceAccountJson: string, impersonate: string) {
  const key = parseServiceAccount(serviceAccountJson);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: impersonate,
  });
  return google.gmail({ version: "v1", auth });
}

type GmailClient = ReturnType<typeof getGmailClient>;

// Gmail's own search returns threads newest-first, so the first hit is the most recent
// conversation with a matching subject.
async function findMostRecentThreadId(gmail: GmailClient, subject: string): Promise<string | null> {
  const escaped = subject.replace(/"/g, '\\"');
  const res = await gmail.users.threads.list({ userId: "me", q: `subject:"${escaped}"`, maxResults: 1 });
  return res.data.threads?.[0]?.id || null;
}

// Pulls the Message-ID (and any References chain) off the last message in the thread, so the
// new message can be threaded in with proper In-Reply-To/References headers — not just a
// matching Subject, which Gmail treats as a hint, not a guarantee.
async function getLastMessageThreadingHeaders(
  gmail: GmailClient,
  threadId: string
): Promise<{ messageId?: string; references?: string }> {
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["Message-ID", "References"],
  });
  const messages = res.data.messages || [];
  const last = messages[messages.length - 1];
  const headers = last?.payload?.headers || [];
  return {
    messageId: headers.find((h) => h.name === "Message-ID")?.value || undefined,
    references: headers.find((h) => h.name === "References")?.value || undefined,
  };
}

function buildRawMessage(mailOptions: Record<string, unknown>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    new MailComposer(mailOptions).compile().build((err: Error | null, message: Buffer) => {
      if (err) reject(err);
      else resolve(message);
    });
  });
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface ThreadedSendParams {
  serviceAccountJson: string;
  impersonate: string; // the mailbox to search and send as, e.g. business@themangotheory.co
  fromName: string;
  to: string;
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer };
}

export interface ThreadedSendResult {
  threaded: boolean; // true if a matching thread was found and replied into
}

// A lightweight connectivity check for Settings — confirms the service account can actually
// act as the given mailbox (i.e. domain-wide delegation is granted with the right scopes)
// without sending anything.
export async function testGmailAccess(serviceAccountJson: string, impersonate: string): Promise<void> {
  const gmail = getGmailClient(serviceAccountJson, impersonate);
  try {
    await gmail.users.getProfile({ userId: "me" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GmailThreadError(
      `Could not access ${impersonate}'s mailbox as this service account. Grant it domain-wide delegation for the Gmail API in your Workspace Admin Console (Security → API controls → Domain-wide delegation), with scopes gmail.readonly and gmail.send. (${message})`
    );
  }
}

// Searches the impersonated mailbox for the most recent thread with a matching subject and
// sends the invoice as a genuine reply inside it (correct threading headers + Gmail's
// threadId). If nothing matches, sends as a normal new message instead — never blocks on
// "no thread found".
export async function sendInThreadOrFresh(params: ThreadedSendParams): Promise<ThreadedSendResult> {
  const gmail = getGmailClient(params.serviceAccountJson, params.impersonate);

  let threadId: string | null = null;
  let inReplyTo: string | undefined;
  let references: string | undefined;

  try {
    threadId = await findMostRecentThreadId(gmail, params.subject);
    if (threadId) {
      const headers = await getLastMessageThreadingHeaders(gmail, threadId);
      inReplyTo = headers.messageId;
      references = [headers.references, headers.messageId].filter(Boolean).join(" ") || undefined;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GmailThreadError(
      `Could not search ${params.impersonate}'s mailbox. Make sure Gmail API domain-wide delegation is granted for this service account (Settings has the setup steps). (${message})`
    );
  }

  const mailOptions: Record<string, unknown> = {
    from: `"${params.fromName}" <${params.impersonate}>`,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: [{ filename: params.attachment.filename, content: params.attachment.content }],
  };
  if (inReplyTo) mailOptions.inReplyTo = inReplyTo;
  if (references) mailOptions.references = references;

  const raw = toBase64Url(await buildRawMessage(mailOptions));

  try {
    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw, ...(threadId ? { threadId } : {}) },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GmailThreadError(`Could not send via the Gmail API. (${message})`);
  }

  return { threaded: !!threadId };
}
