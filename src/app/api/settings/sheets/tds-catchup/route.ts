import { NextResponse } from "next/server";
import { catchUpTdsTracker } from "@/lib/tdsSync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Safety-net catch-up: writes any creator payment that withheld TDS and hasn't yet been synced
// to the TDS tracker sheet, regardless of why it was missed. Safe to re-run any number of
// times — already-synced payments are never revisited.
export async function POST() {
  const result = await catchUpTdsTracker();
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
