import { google } from "googleapis";
import { Readable } from "stream";

export class DriveSyncError extends Error {}

function parseServiceAccount(json: string) {
  try {
    return JSON.parse(json) as { client_email: string; private_key: string };
  } catch {
    throw new DriveSyncError(
      "The service account key isn't valid JSON. Paste the full contents of the key file you downloaded from Google Cloud Console."
    );
  }
}

function getDriveClient(json: string) {
  const key = parseServiceAccount(json);
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

async function findOrCreateFolder(
  drive: ReturnType<typeof getDriveClient>,
  name: string,
  parentId: string
): Promise<string> {
  const escaped = name.replace(/'/g, "\\'");
  const res = await drive.files.list({
    q: `name='${escaped}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const existing = res.data.files?.[0];
  if (existing?.id) return existing.id;

  const created = await drive.files.create({
    requestBody: { name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] },
    fields: "id",
    supportsAllDrives: true,
  });
  if (!created.data.id) throw new DriveSyncError(`Could not create Drive folder "${name}".`);
  return created.data.id;
}

const TYPE_LABEL: Record<string, string> = {
  SALES: "Sales Invoices",
  COMMISSION: "Commission Invoices",
  PURCHASE: "Purchase Bills",
};

export async function testDriveConnection(rootFolderId: string, serviceAccountJson: string) {
  const drive = getDriveClient(serviceAccountJson);
  try {
    const res = await drive.files.get({ fileId: rootFolderId, fields: "id, name, mimeType", supportsAllDrives: true });
    if (res.data.mimeType !== "application/vnd.google-apps.folder") {
      throw new DriveSyncError("That ID isn't a folder.");
    }
    const key = parseServiceAccount(serviceAccountJson);
    return { name: res.data.name || "(untitled)", serviceAccountEmail: key.client_email };
  } catch (err: unknown) {
    if (err instanceof DriveSyncError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new DriveSyncError(
      `Could not open that Drive folder. Make sure it's inside a Shared Drive with the service account added as a member (Content Manager or higher), and the folder ID is correct. Service accounts can't use regular My Drive folders. (${message})`
    );
  }
}

async function uploadOrOverwrite(
  drive: ReturnType<typeof getDriveClient>,
  fyFolderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string = "application/pdf"
): Promise<string | null> {
  const escaped = fileName.replace(/'/g, "\\'");
  const existing = await drive.files.list({
    q: `name='${escaped}' and '${fyFolderId}' in parents and trashed=false`,
    fields: "files(id)",
    spaces: "drive",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const media = { mimeType, body: bufferToStream(fileBuffer) };
  const existingId = existing.data.files?.[0]?.id;
  if (existingId) {
    const updated = await drive.files.update({
      fileId: existingId,
      media,
      fields: "webViewLink",
      supportsAllDrives: true,
    });
    return updated.data.webViewLink || null;
  } else {
    const created = await drive.files.create({
      requestBody: { name: fileName, parents: [fyFolderId] },
      media,
      fields: "webViewLink",
      supportsAllDrives: true,
    });
    return created.data.webViewLink || null;
  }
}

// Uploads (or overwrites, on re-generation) an invoice's PDF into
// {rootFolder}/{Type}/{FY}/{number} - {party}.pdf — mirrors the Sheets sync's use of the same
// service account, so sharing one Drive folder with that same client_email turns it on.
export async function uploadInvoicePdf(params: {
  serviceAccountJson: string;
  rootFolderId: string;
  type: "SALES" | "PURCHASE" | "COMMISSION";
  fy: string;
  month?: string;
  number: string;
  partyName: string;
  pdfBuffer: Buffer;
}) {
  const { serviceAccountJson, rootFolderId, type, fy, month, number, partyName, pdfBuffer } = params;
  const drive = getDriveClient(serviceAccountJson);
  const typeFolderId = await findOrCreateFolder(drive, TYPE_LABEL[type] || type, rootFolderId);
  let leafFolderId = await findOrCreateFolder(drive, fy, typeFolderId);
  // Every type gets a month subfolder, keyed off the invoice's own date — makes the Drive
  // filing match the month the work was actually done in, for accounting.
  if (month) {
    leafFolderId = await findOrCreateFolder(drive, month, leafFolderId);
  }
  const fileName = `${number.replace(/\//g, "-")} - ${partyName}.pdf`.trim();
  return uploadOrOverwrite(drive, leafFolderId, fileName, pdfBuffer);
}

// Uploads the original bill a creator sent us (PDF, Excel, or CSV — whatever was uploaded for
// Gemini extraction), alongside our own generated PDF in the same Type/FY folder — so the
// source document stays on file too, not just our regenerated version of it.
export async function uploadOriginalBill(params: {
  serviceAccountJson: string;
  rootFolderId: string;
  fy: string;
  month?: string;
  number: string;
  partyName: string;
  fileBuffer: Buffer;
  mimeType: string;
  fileExt: string;
}) {
  const { serviceAccountJson, rootFolderId, fy, month, number, partyName, fileBuffer, mimeType, fileExt } = params;
  const drive = getDriveClient(serviceAccountJson);
  const typeFolderId = await findOrCreateFolder(drive, TYPE_LABEL.PURCHASE, rootFolderId);
  let leafFolderId = await findOrCreateFolder(drive, fy, typeFolderId);
  if (month) {
    leafFolderId = await findOrCreateFolder(drive, month, leafFolderId);
  }
  const fileName = `${number.replace(/\//g, "-")} - ${partyName} - original bill.${fileExt}`.trim();
  return uploadOrOverwrite(drive, leafFolderId, fileName, fileBuffer, mimeType);
}

function bufferToStream(buffer: Buffer) {
  return Readable.from(buffer);
}

// Extracts the file ID out of a Drive webViewLink (e.g.
// "https://drive.google.com/file/d/FILE_ID/view") — that's all `Invoice.pdfPath` ever stores.
function fileIdFromLink(link: string): string | null {
  const match = link.match(/\/file\/d\/([^/]+)/);
  return match?.[1] || null;
}

// Deletes the Drive file behind a stored webViewLink, so removing an invoice in the app also
// removes its filed copy instead of leaving an orphaned file behind. A no-op (not an error) if
// the link doesn't look like a Drive file link, or the file's already gone.
export async function deleteFileByLink(link: string, serviceAccountJson: string): Promise<void> {
  const fileId = fileIdFromLink(link);
  if (!fileId) return;
  const drive = getDriveClient(serviceAccountJson);
  try {
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch (err: unknown) {
    // Already deleted / never existed — fine. Anything else, surface it.
    const status = (err as { code?: number })?.code;
    if (status === 404) return;
    const message = err instanceof Error ? err.message : String(err);
    throw new DriveSyncError(`Could not delete the Drive file. (${message})`);
  }
}
