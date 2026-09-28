import { NextRequest, NextResponse } from "next/server";
import { testSheetConnection, SheetSyncError } from "@/lib/googleSheets";

export async function POST(req: NextRequest) {
  const { spreadsheetId, serviceAccountJson } = await req.json();
  if (!spreadsheetId || !serviceAccountJson) {
    return NextResponse.json(
      { error: "Spreadsheet ID and service account key are both required." },
      { status: 400 }
    );
  }
  try {
    const result = await testSheetConnection(spreadsheetId, serviceAccountJson);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof SheetSyncError ? err.message : "Connection failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
