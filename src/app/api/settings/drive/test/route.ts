import { NextRequest, NextResponse } from "next/server";
import { testDriveConnection, DriveSyncError } from "@/lib/googleDrive";

export async function POST(req: NextRequest) {
  const { folderId, serviceAccountJson } = await req.json();
  if (!folderId || !serviceAccountJson) {
    return NextResponse.json(
      { error: "Drive folder ID and service account key are both required." },
      { status: 400 }
    );
  }
  try {
    const result = await testDriveConnection(folderId, serviceAccountJson);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof DriveSyncError ? err.message : "Connection failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
