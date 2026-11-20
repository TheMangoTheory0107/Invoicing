import { NextResponse } from "next/server";
import { buildFullBackupXlsxBuffer } from "@/lib/backup";

export const dynamic = "force-dynamic";

export async function GET() {
  const buffer = await buildFullBackupXlsxBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mango-theory-backup-${stamp}.xlsx"`,
    },
  });
}
