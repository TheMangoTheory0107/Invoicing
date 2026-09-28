// Indian financial year helpers: FY runs Apr 1 - Mar 31, labeled like "25-26".

// All dates are treated as pure calendar dates at UTC midnight, so financial-year
// and month calculations are stable regardless of the host machine's local timezone.

export function financialYearFor(date: Date): string {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1; // 1-12
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function monthLabel(date: Date): string {
  return MONTH_NAMES[date.getUTCMonth()];
}

// Formats a sequence number as a 3+ digit zero-padded string: 1 -> "001", 100 -> "100", 1000 -> "1000".
export function formatSequence(n: number): string {
  return n < 10 ? `00${n}` : n < 100 ? `0${n}` : String(n);
}

export function buildInvoiceNumber(seq: number, fy: string, prefix?: string): string {
  return prefix ? `${prefix}/${fy}/${formatSequence(seq)}` : `${formatSequence(seq)}/${fy}`;
}

export function currentFY(): string {
  return financialYearFor(new Date());
}

// Parses a "YYYY-MM-DD" (from a date input) into a UTC-midnight Date.
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

// Formats a Date (assumed UTC-midnight calendar date) back to "YYYY-MM-DD".
export function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDateDMY(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

// Formats a real timestamp (not a pure calendar date) as DD/MM/YYYY, HH:MM IST — explicit
// +5:30 math rather than the host's local timezone, since the server may run in UTC (e.g.
// on Vercel) regardless of where the business actually is.
export function formatDateTimeIST(isoString: string): string {
  const utcMs = new Date(isoString).getTime();
  const ist = new Date(utcMs + 5.5 * 60 * 60 * 1000);
  const d = String(ist.getUTCDate()).padStart(2, "0");
  const m = String(ist.getUTCMonth() + 1).padStart(2, "0");
  const y = ist.getUTCFullYear();
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${d}/${m}/${y}, ${hh}:${mm} IST`;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
