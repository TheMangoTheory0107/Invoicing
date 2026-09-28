import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncOriginalBillToDrive } from "@/lib/driveSync";
import { detectPurchaseBillFileKind, mimeTypeForKind } from "@/lib/purchaseBillFileType";

export const dynamic = "force-dynamic";

// Stores the original bill (PDF, Excel, or CSV — whatever was uploaded for Gemini extraction)
// in Drive — this is the canonical filed copy for a Purchase bill, so its link gets saved onto
// the invoice too, for a "view in Drive" link in the portal. A no-op if Drive sync isn't configured.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { creator: true },
  });
  if (!invoice || invoice.type !== "PURCHASE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const detected = detectPurchaseBillFileKind(file.name, file.type);
  if ("error" in detected) {
    return NextResponse.json({ error: detected.error }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const driveSyncResult = await syncOriginalBillToDrive({
    fy: invoice.fy,
    month: invoice.month,
    number: invoice.number,
    partyName: invoice.creator?.name || "Unknown",
    fileBuffer: buffer,
    mimeType: mimeTypeForKind(detected.kind),
    fileExt: detected.kind,
  });

  if (driveSyncResult.link) {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath: driveSyncResult.link } });
  }

  return NextResponse.json({ driveSyncResult });
}
