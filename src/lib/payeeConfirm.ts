import crypto from "crypto";

// Signs/verifies the "mark this creator as added as a payee" link sent by email — that link
// has to work with a single click, with no login (it's opened straight from an inbox, often on
// a phone), so a signed token stands in for authentication instead. Reuses SESSION_SECRET rather
// than adding yet another env var; the "payee:" prefix just keeps this HMAC's input distinct
// from anything else that might ever reuse the same secret.
function secret(): string {
  return process.env.SESSION_SECRET || "";
}

export function signPayeeToken(partyId: string): string {
  return crypto.createHmac("sha256", secret()).update(`payee:${partyId}`).digest("hex");
}

export function verifyPayeeToken(partyId: string, token: string): boolean {
  const expected = signPayeeToken(partyId);
  const given = Buffer.from(token || "", "hex");
  const want = Buffer.from(expected, "hex");
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
