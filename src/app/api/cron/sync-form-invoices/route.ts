import { NextRequest, NextResponse } from "next/server";
import { syncFormResponses } from "@/lib/formIngest";
import { catchUpTdsTracker } from "@/lib/tdsSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron hits this on a schedule (see vercel.json). Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` when that env var is set — anything else is rejected,
// so this can't be triggered by a random request to the URL.
//
// The TDS tracker catch-up rides along here rather than getting its own cron entry — Vercel's
// free plan only allows each schedule to fire once a day, and piggybacking means it still runs
// automatically every day with no extra schedule slot needed. It's always safe to re-run (see
// catchUpTdsTracker), so sharing a run with the form sync changes nothing about its behavior.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await syncFormResponses();
  const tdsCatchUpResult = await catchUpTdsTracker();
  return NextResponse.json({ ...result, tdsCatchUpResult });
}
