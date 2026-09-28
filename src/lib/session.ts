import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  loggedIn?: boolean;
}

const secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  throw new Error(
    "SESSION_SECRET env var must be set to a random string at least 32 characters long."
  );
}

export const sessionOptions: SessionOptions = {
  password: secret,
  cookieName: "invoicing_session",
  cookieOptions: {
    // Vercel always sets VERCEL=1 at runtime, so this is true when actually deployed
    // behind real HTTPS — and false for the double-click Mac app, which only ever runs on
    // plain http://localhost (a Secure cookie there gets silently dropped by the browser;
    // Safari enforces this strictly, unlike Chrome's localhost exception, and login would
    // appear to "hang" while actually just bouncing back on every redirect).
    secure: !!process.env.VERCEL,
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};

export function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}
