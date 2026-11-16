import { NextRequest, NextResponse } from "next/server";
import { unsealData } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// /api/cron/* is deliberately public here — it has its own authorization check (a CRON_SECRET
// bearer token), separate from a logged-in user's session, since Vercel's own cron scheduler
// and the Google Apps Script form-submit trigger both hit it with no session cookie at all.
// Without this, this login wall rejected every single call before the route's own check ever
// ran — meaning the daily automatic sync (and any on-submit trigger) was silently failing.
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/setup", "/payee-confirm", "/api/payee/confirm"];
const PUBLIC_PREFIXES = ["/api/cron/"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(sessionOptions.cookieName)?.value;
  let loggedIn = false;

  if (cookie) {
    try {
      const data = await unsealData<SessionData>(cookie, {
        password: sessionOptions.password,
      });
      loggedIn = !!data.loggedIn;
    } catch {
      loggedIn = false;
    }
  }

  if (!loggedIn) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
