import ExcelJS from "exceljs";
import Papa from "papaparse";
import { financialYearFor, monthLabel } from "@/lib/fy";

export type ImportRow = Record<string, string>;

function normalizeHeader(h: unknown): string {
  return String(h ?? "").trim();
}

export async function parseUploadedFile(buffer: Buffer, filename: string): Promise<ImportRow[]> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    const parsed = Papa.parse<ImportRow>(text, { header: true, skipEmptyLines: true });
    return parsed.data.map((row) => {
      const clean: ImportRow = {};
      for (const [k, v] of Object.entries(row)) clean[normalizeHeader(k)] = String(v ?? "").trim();
      return clean;
    });
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = normalizeHeader(cell.value);
  });

  const rows: ImportRow[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: ImportRow = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (!header) return;
      let value: string;
      try {
        if (cell.value instanceof Date) {
          value = cell.value.toISOString();
        } else if (cell.value && typeof cell.value === "object" && "text" in cell.value) {
          value = String((cell.value as { text: unknown }).text ?? "");
        } else {
          // cell.text throws for a merged cell's non-master slots (a known exceljs quirk) —
          // fall straight to the raw value in that case.
          value = cell.text ?? String(cell.value ?? "");
        }
      } catch {
        value = cell.value != null ? String(cell.value) : "";
      }
      value = value.trim();
      if (value) hasValue = true;
      obj[header] = value;
    });
    if (hasValue) rows.push(obj);
  });

  return rows;
}

// Case-insensitive, whitespace-tolerant field lookup by any of several candidate header names.
export function field(row: ImportRow, ...names: string[]): string {
  for (const name of names) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().replace(/\s+/g, " ").trim() === name.toLowerCase()) {
        return row[key];
      }
    }
  }
  return "";
}

// Parses dates from ISO strings (from Excel date cells), DD/MM/YYYY, or YYYY-MM-DD text.
export function parseFlexibleDate(value: string): Date | null {
  if (!value) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
  if (iso) {
    const d = new Date(value);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymd) return new Date(Date.UTC(+ymd[1], +ymd[2] - 1, +ymd[3]));

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (slash) {
    const a = +slash[1];
    const b = +slash[2];
    const year = +slash[3];
    // Slash-separated dates are ambiguous (DD/MM vs MM/DD) and this data mixes both. Prefer the
    // Indian DD/MM convention used everywhere else in these sheets, but fall back to MM/DD when
    // the first number can't be a day-of-month interpretation... actually: prefer whichever
    // reading is valid, defaulting to DD/MM when both are (since that's this data's convention).
    if (b >= 1 && b <= 12) return new Date(Date.UTC(year, b - 1, a)); // DD/MM/YYYY
    if (a >= 1 && a <= 12) return new Date(Date.UTC(year, a - 1, b)); // MM/DD/YYYY fallback
    return null;
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
  }
  return null;
}

export function parseFlexibleNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[₹,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export function deriveFyMonth(date: Date) {
  return { fy: financialYearFor(date), month: monthLabel(date) };
}

// Parses "001/25-26" -> { seq: 1, fy: "25-26" }. Returns null if it doesn't match.
export function parseInvoiceNumber(value: string): { seq: number; fy: string } | null {
  const m = /^(\d+)\/(\d{2}-\d{2})$/.exec(value.trim());
  if (!m) return null;
  return { seq: parseInt(m[1], 10), fy: m[2] };
}
