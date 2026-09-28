import ExcelJS from "exceljs";

// Builds a single-sheet .xlsx workbook buffer for CA-friendly exports — a real Excel file
// (not CSV-as-.xlsx), with a bold header row and auto-sized columns.
export async function buildXlsxBuffer(
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);

  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true };
  rows.forEach((row) => sheet.addRow(row));

  sheet.columns.forEach((col, i) => {
    const header = headers[i] || "";
    const maxDataLen = rows.reduce((max, row) => {
      const val = row[i];
      const len = val == null ? 0 : String(val).length;
      return Math.max(max, len);
    }, 0);
    col.width = Math.min(Math.max(header.length, maxDataLen) + 2, 40);
  });

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

// Same as buildXlsxBuffer but for a workbook with multiple tabs — used for the full-data
// backup export and the monthly GST filing pack.
export async function buildMultiSheetXlsxBuffer(
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const { name, headers, rows } of sheets) {
    const sheet = workbook.addWorksheet(name.slice(0, 31));
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));

    sheet.columns.forEach((col, i) => {
      const header = headers[i] || "";
      const maxDataLen = rows.reduce((max, row) => {
        const val = row[i];
        const len = val == null ? 0 : String(val).length;
        return Math.max(max, len);
      }, 0);
      col.width = Math.min(Math.max(header.length, maxDataLen) + 2, 40);
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
