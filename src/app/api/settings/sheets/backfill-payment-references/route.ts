import { NextResponse } from "next/server";
import { backfillPaymentReferences } from "@/lib/sheetSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// One-time (but safe to re-run) catch-up: reads the "UTR / Reference" column out of the Sales,
// Commission, and Purchase Register tabs and writes it onto the matching payment(s) already in
// the app — same job that happens incrementally on every invoice save going forward.
export async function POST() {
  const result = await backfillPaymentReferences();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
