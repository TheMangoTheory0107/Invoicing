import { NextResponse } from "next/server";
import { syncFormResponses } from "@/lib/formIngest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Manual "check now" trigger — same sync the scheduled cron runs, for testing or an on-demand
// catch-up without waiting for the next scheduled run.
export async function POST() {
  const result = await syncFormResponses();
  return NextResponse.json(result);
}
