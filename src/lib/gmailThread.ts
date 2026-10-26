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
): Promise<{ messageId?: string; references?: string; from?: string; to?: string; cc?: string }> {
  const res = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["Message-ID", "References", "From", "To", "Cc"],
  });
  const messages = res.data.messages || [];
  const last = messages[messages.length - 1];
  const headers = last?.payload?.headers || [];
  const find = (name: string) => headers.find((h) => h.name === name)?.value || undefined;
  return {
    messageId: find("Message-ID"),
    references: find("References"),
    from: find("From"),
    to: find("To"),
    cc: find("Cc"),
  };
}

// A header value is comma-separated addresses, each either `"Sarah Khan" <sarah@agency.com>`
// or a bare `sarah@agency.com`. Pulls out every address, not just the first.
function extractAllEmailAddresses(headerValue: string): string[] {
  const bracketed = Array.from(headerValue.matchAll(/<([^>]+)>/g))
    .map((m) => m[1].trim())
    .filter((a) => a.includes("@"));
  if (bracketed.length > 0) return bracketed;
  return headerValue
    .split(",")
    .map((part) => part.trim())
    .filter((a) => a.includes("@"));
}

// Reply-All: everyone who was on the last message (its From, To and Cc) stays on the reply,
// minus our own mailbox. If they sent the last message, it goes To them with everyone else
// Cc'd; if we sent it ourselves (e.g. still waiting on a reply), there's no distinct "sender"
// to single out, so the whole original audience goes in To.
function resolveReplyAllRecipients(
  headers: { from?: string; to?: string; cc?: string },
  impersonate: string
): { to: string[]; cc: string[] } {
  const isSelf = (a: string) => a.toLowerCase() === impersonate.toLowerCase();
  const fromAddrs = headers.from ? extractAllEmailAddresses(headers.from) : [];
  const toAddrs = headers.to ? extractAllEmailAddresses(headers.to) : [];
  const ccAddrs = headers.cc ? extractAllEmailAddresses(headers.cc) : [];

  const sentByUs = fromAddrs.some(isSelf);
  const dedupe = (addrs: string[]) => {
    const seen = new Set<string>();
    return addrs.filter((a) => {
      const key = a.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  if (sentByUs) {
    const to = dedupe([...toAddrs, ...ccAddrs].filter((a) => !isSelf(a)));
    return { to, cc: [] };
  }

  const to = dedupe(fromAddrs.filter((a) => !isSelf(a)));
  const cc = dedupe([...toAddrs, ...ccAddrs].filter((a) => !isSelf(a) && !to.some((t) => t.toLowerCase() === a.toLowerCase())));
  return { to, cc };
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
  to: string; // the primary recipient(s), comma-separated — either resolved from the thread, or the fallback
  cc?: string; // everyone else who was on the original thread (comma-separated), if any
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
// sends the invoice as a genuine Reply-All inside it (correct threading headers + Gmail's
// threadId) — everyone who was on that last message (sender, To, and Cc) stays on this one,
// our own mailbox excluded. `params.to` is only a fallback, used when no thread matches —
// never blocks on "no thread found" as long as a fallback address is given.
export async function sendInThreadOrFresh(params: ThreadedSendParams): Promise<ThreadedSendResult> {
  const gmail = getGmailClient(params.serviceAccountJson, params.impersonate);

  let threadId: string | null = null;
  let inReplyTo: string | undefined;
  let references: string | undefined;
  let resolvedTo: string[] = [];
  let resolvedCc: string[] = [];

  try {
    threadId = await findMostRecentThreadId(gmail, params.subject);
    if (threadId) {
      const headers = await getLastMessageThreadingHeaders(gmail, threadId);
      inReplyTo = headers.messageId;
      references = [headers.references, headers.messageId].filter(Boolean).join(" ") || undefined;
      const recipients = resolveReplyAllRecipients(headers, params.impersonate);
      resolvedTo = recipients.to;
      resolvedCc = recipients.cc;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new GmailThreadError(
      `Could not search ${params.impersonate}'s mailbox. Make sure Gmail API domain-wide delegation is granted for this service account (Settings has the setup steps). (${message})`
    );
  }

  const to = resolvedTo.length > 0 ? resolvedTo : params.to ? [params.to] : [];
  if (to.length === 0) {
    throw new GmailThreadError(
      threadId
        ? "Found a matching thread, but couldn't tell who it was with — add an email address to send to."
        : "No matching thread found, and no email address was given to fall back to."
    );
  }
  // The fallback-to-a-typed-address path has no thread to pull a Cc list from.
  const cc = resolvedTo.length > 0 ? resolvedCc : [];

  const mailOptions: Record<string, unknown> = {
    from: `"${params.fromName}" <${params.impersonate}>`,
    to,
    subject: params.subject,
    html: params.html,
    attachments: [{ filename: params.attachment.filename, content: params.attachment.content }],
  };
  if (cc.length > 0) mailOptions.cc = cc;
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

  return { threaded: !!threadId, to: to.join(", "), cc: cc.length > 0 ? cc.join(", ") : undefined };
}
