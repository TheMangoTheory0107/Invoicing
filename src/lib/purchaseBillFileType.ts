// What kind of file a Purchase bill upload/extract can actually work with — used both
// client-side (before upload) and server-side (authoritative) so the user gets the same
// clear, actionable message either way instead of a generic "unsupported file" error.

export type PurchaseBillFileKind = "pdf" | "xlsx" | "csv" | "docx" | "image";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

export const PURCHASE_BILL_ACCEPT =
  ".pdf,.xlsx,.csv,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif," +
  "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv," +
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document," +
  "image/jpeg,image/png,image/webp,image/heic,image/heif";

const MIME_BY_KIND: Record<Exclude<PurchaseBillFileKind, "image">, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// For "image", the real mime type (jpeg vs png vs...) varies by file, so the caller's own
// detected mime type is passed straight through instead of being guessed here.
export function mimeTypeForKind(kind: PurchaseBillFileKind, actualMimeType?: string): string {
  if (kind === "image") return actualMimeType || "image/jpeg";
  return MIME_BY_KIND[kind];
}

export function detectPurchaseBillFileKind(
  fileName: string,
  mimeType: string
): { kind: PurchaseBillFileKind } | { error: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf" || mimeType === "application/pdf") return { kind: "pdf" };
  if (ext === "xlsx" || mimeType === MIME_BY_KIND.xlsx) return { kind: "xlsx" };
  if (ext === "csv" || mimeType === "text/csv") return { kind: "csv" };
  if (ext === "docx" || mimeType === MIME_BY_KIND.docx) return { kind: "docx" };
  if (IMAGE_EXTENSIONS.has(ext) || mimeType.startsWith("image/")) return { kind: "image" };

  if (ext === "numbers") {
    return {
      error:
        "Numbers files can't be read directly. In the Numbers app, use File → Export To → PDF (or Excel), then upload that file instead.",
    };
  }
  if (ext === "xls") {
    return {
      error:
        "Old-style .xls files aren't supported. Open it and use Save As → Excel Workbook (.xlsx), or export to PDF, then upload that instead.",
    };
  }
  if (ext === "doc") {
    return {
      error:
        "Old-style .doc files aren't supported. Open it and use Save As → Word Document (.docx), or export to PDF, then upload that instead.",
    };
  }

  return { error: "Please upload a PDF, Word (.docx), Excel (.xlsx), CSV, or a photo of the bill." };
}
