import ExcelJS from "exceljs";

// Flattens every sheet of an uploaded vendor bill workbook into plain text — good enough for
// Gemini to read the numbers off, without needing a mime type it can treat as a document.
export async function xlsxBufferToText(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`--- Sheet: ${sheet.name} ---`);
    sheet.eachRow((row) => {
      const cells = (row.values as ExcelJS.CellValue[])
        .slice(1)
        .map((v) => cellToString(v))
        .map((v) => v.trim());
      if (cells.some((c) => c !== "")) {
        lines.push(cells.join(" | "));
      }
    });
  });

  return lines.join("\n");
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value) return String(value.text);
    if ("result" in value) return value.result === undefined ? "" : String(value.result);
    return "";
  }
  return String(value);
}

export function csvBufferToText(buffer: Buffer): string {
  return buffer.toString("utf-8");
}
