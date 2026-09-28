import { prisma } from "@/lib/prisma";
import { uploadInvoicePdf, uploadOriginalBill, deleteFileByLink, DriveSyncError } from "@/lib/googleDrive";

export interface DriveSyncResult {
  attempted: boolean;
  ok: boolean;
  error?: string;
  link?: string;
}

// Uploads an invoice's already-rendered PDF to the configured Drive folder. Never throws —
// like the Sheets sync, a Drive outage should never block saving the invoice itself.
export async function syncInvoiceToDrive(params: {
  type: "SALES" | "PURCHASE" | "COMMISSION";
  fy: string;
  month?: string;
  number: string;
  partyName: string;
  pdfBuffer: Buffer;
}): Promise<DriveSyncResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.driveFolderId || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }
  try {
    const link = await uploadInvoicePdf({
      serviceAccountJson: config.serviceAccountJson,
      rootFolderId: config.driveFolderId,
      type: params.type,
      fy: params.fy,
      month: params.month,
      number: params.number,
      partyName: params.partyName,
      pdfBuffer: params.pdfBuffer,
    });
    return { attempted: true, ok: true, link: link || undefined };
  } catch (err) {
    const message = err instanceof DriveSyncError ? err.message : err instanceof Error ? err.message : "Unexpected Drive sync error.";
    return { attempted: true, ok: false, error: message };
  }
}

// Uploads the original bill a creator sent us (PDF, Excel, or CSV — as uploaded for Gemini
// extraction) into the same Drive folder as the invoice, alongside our own generated PDF.
export async function syncOriginalBillToDrive(params: {
  fy: string;
  month?: string;
  number: string;
  partyName: string;
  fileBuffer: Buffer;
  mimeType: string;
  fileExt: string;
}): Promise<DriveSyncResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.driveFolderId || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }
  try {
    const link = await uploadOriginalBill({
      serviceAccountJson: config.serviceAccountJson,
      rootFolderId: config.driveFolderId,
      fy: params.fy,
      month: params.month,
      number: params.number,
      partyName: params.partyName,
      fileBuffer: params.fileBuffer,
      mimeType: params.mimeType,
      fileExt: params.fileExt,
    });
    return { attempted: true, ok: true, link: link || undefined };
  } catch (err) {
    const message = err instanceof DriveSyncError ? err.message : err instanceof Error ? err.message : "Unexpected Drive sync error.";
    return { attempted: true, ok: false, error: message };
  }
}

// Deletes the Drive file behind a saved pdfPath — called when the invoice itself is deleted,
// so the filed copy doesn't linger as an orphan. Never throws; a Drive outage should never
// block deleting the invoice record.
export async function deleteInvoiceDriveFile(pdfPath: string): Promise<DriveSyncResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }
  try {
    await deleteFileByLink(pdfPath, config.serviceAccountJson);
    return { attempted: true, ok: true };
  } catch (err) {
    const message = err instanceof DriveSyncError ? err.message : err instanceof Error ? err.message : "Unexpected Drive delete error.";
    return { attempted: true, ok: false, error: message };
  }
}
