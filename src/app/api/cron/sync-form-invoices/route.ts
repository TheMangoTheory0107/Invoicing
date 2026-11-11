import { NextRequest, NextResponse } from "next/server";
import { syncFormResponses } from "@/lib/formIngest";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron hits this on a schedule (see vercel.json). Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` when that env var is set — anything else is rejected,
// so this can't be triggered by a random request to the URL.
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${expected}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const result = await syncFormResponses();
  return NextResponse.json(result);
}
