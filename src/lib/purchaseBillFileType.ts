// What kind of file a Purchase bill upload/extract can actually work with — used both
// client-side (before upload) and server-side (authoritative) so the user gets the same
// clear, actionable message either way instead of a generic "unsupported file" error.

export type PurchaseBillFileKind = "pdf" | "xlsx" | "csv";

export const PURCHASE_BILL_ACCEPT =
  ".pdf,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

const MIME_BY_KIND: Record<PurchaseBillFileKind, string> = {
  pdf: "application/pdf",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
};

export function mimeTypeForKind(kind: PurchaseBillFileKind): string {
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

  return { error: "Please upload a PDF, Excel (.xlsx), or CSV file." };
}
