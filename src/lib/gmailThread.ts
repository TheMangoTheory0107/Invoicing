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
// matching Subject, which Gmail treats as a hint, not a guarantee. Also pulls From/To so the
// reply can go to whoever's actually on the other end of that thread, without needing the
// caller to supply an address at all.
async function getLastMessageThreadingHeaders(
  gmail: GmailClient,
  threadId: string
): Promise<{ messageId?: string; references?: string; from?: string; to?: string }> {
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["Message-ID", "References", "From", "To"],
  });
  const messages = res.data.messages || [];
  const last = messages[messages.length - 1];
  const headers = last?.payload?.headers || [];
  const find = (name: string) => headers.find((h) => h.name === name)?.value || undefined;
  return { messageId: find("Message-ID"), references: find("References"), from: find("From"), to: find("To") };
}

// Headers look like `"Sarah Khan" <sarah@agency.com>` or just `sarah@agency.com` — pull out
// just the address.
function extractEmailAddress(headerValue: string): string | null {
  const match = headerValue.match(/<([^>]+)>/);
  const address = (match ? match[1] : headerValue).trim();
  return address.includes("@") ? address : null;
}

// Whoever's on the other end of the last message: if we sent it ourselves, that's whoever we
// sent it TO; if they sent it, that's whoever it's FROM. Either way, no address needs typing in.
function resolveCounterpartAddress(
  headers: { from?: string; to?: string },
  impersonate: string
): string | null {
  const fromAddress = headers.from ? extractEmailAddress(headers.from) : null;
  const sentByUs = fromAddress?.toLowerCase() === impersonate.toLowerCase();
  const candidate = sentByUs ? headers.to : headers.from;
  return candidate ? extractEmailAddress(candidate) : null;
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
  to?: string; // only used as a fallback — if a thread is found, its own participant wins
  subject: string;
  html: string;
  attachment: { filename: string; content: Buffer };
}

export interface ThreadedSendResult {
  threaded: boolean; // true if a matching thread was found and replied into
  to: string; // the address actually used — either resolved from the thread, or the fallback
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
// threadId), addressed to whoever's actually on the other end of that thread. `params.to` is
// only a fallback, used when no thread matches — never blocks on "no thread found" as long as
// a fallback address is given.
export async function sendInThreadOrFresh(params: ThreadedSendParams): Promise<ThreadedSendResult> {
  const gmail = getGmailClient(params.serviceAccountJson, params.impersonate);

  let threadId: string | null = null;
  let inReplyTo: string | undefined;
  let references: string | undefined;
  let resolvedTo: string | null = null;

  try {
    threadId = await findMostRecentThreadId(gmail, params.subject);
    if (threadId) {
      const headers = await getLastMessageThreadingHeaders(gmail, threadId);
      inReplyTo = headers.messageId;
      references = [headers.references, headers.messageId].filter(Boolean).join(" ") || undefined;
      resolvedTo = resolveCounterpartAddress(headers, params.impersonate);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GmailThreadError(
      `Could not search ${params.impersonate}'s mailbox. Make sure Gmail API domain-wide delegation is granted for this service account (Settings has the setup steps). (${message})`
    );
  }

  const to = resolvedTo || params.to;
  if (!to) {
    throw new GmailThreadError(
      threadId
        ? "Found a matching thread, but couldn't tell who it was with — add an email address to send to."
        : "No matching thread found, and no email address was given to fall back to."
    );
  }

  const mailOptions: Record<string, unknown> = {
    from: `"${params.fromName}" <${params.impersonate}>`,
    to,
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

  return { threaded: !!threadId, to };
}
