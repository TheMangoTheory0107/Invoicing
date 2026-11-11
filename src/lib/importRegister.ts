import ExcelJS from "exceljs";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { financialYearFor, monthLabel } from "@/lib/fy";

export type ImportRow = Record<string, string>;

function normalizeHeader(h: unknown): string {
  return String(h ?? "").trim();
}

// Reads any supported upload into a plain 2D array of trimmed cell strings, with no assumption
// about which row holds the headers — callers that know where their header row lives (e.g. bank
// exports with several rows of letterhead first) scan this themselves.
export async function loadRawRows(buffer: Buffer, filename: string): Promise<string[][]> {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    return parsed.data.map((row) => row.map((v) => String(v ?? "").trim()));
  }

  // Legacy Excel 97-2003 binary format (.xls) — ExcelJS only understands the modern OOXML
  // (.xlsx) zip format, so this needs a separate reader.
  if (lower.endsWith(".xls")) {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" });
    return rows.map((row) => row.map((v) => xlsCellToString(v)));
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const rows: string[][] = [];
  ws.eachRow((row) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cells[colNumber - 1] = excelCellToString(cell);
    });
    rows.push(cells);
  });
  return rows;
}

function xlsCellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function excelCellToString(cell: ExcelJS.Cell): string {
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
  return value.trim();
}

// Converts raw rows into header-keyed objects, treating `headerRowIndex` as the header row.
export function rowsToObjects(rawRows: string[][], headerRowIndex: number): ImportRow[] {
  const headers = (rawRows[headerRowIndex] || []).map(normalizeHeader);
  const rows: ImportRow[] = [];
  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const raw = rawRows[i];
    if (!raw) continue;
    const obj: ImportRow = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      if (!header) return;
      const value = (raw[idx] ?? "").trim();
      if (value) hasValue = true;
      obj[header] = value;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

export async function parseUploadedFile(buffer: Buffer, filename: string): Promise<ImportRow[]> {
  const rawRows = await loadRawRows(buffer, filename);
  return rowsToObjects(rawRows, 0);
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

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value);
  if (slash) {
    const a = +slash[1];
    const b = +slash[2];
    // Bank statement exports often use 2-digit years (e.g. "11/11/26").
    const year = slash[3].length === 2 ? (+slash[3] <= 68 ? 2000 + +slash[3] : 1900 + +slash[3]) : +slash[3];
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
