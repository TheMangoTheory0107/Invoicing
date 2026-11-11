import { loadRawRows, rowsToObjects, field, parseFlexibleDate, parseFlexibleNumber } from "@/lib/importRegister";

export interface BankTransaction {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // always positive
  direction: "CREDIT" | "DEBIT";
}

const DATE_HEADER_NAMES = ["Date", "Txn Date", "Transaction Date", "Value Date", "Post Date"];
const AMOUNT_HEADER_NAMES = [
  "Credit",
  "Credit Amount",
  "Deposit",
  "Deposit Amt",
  "Deposit Amt.",
  "Debit",
  "Debit Amount",
  "Withdrawal",
  "Withdrawal Amt",
  "Withdrawal Amt.",
  "Amount",
  "Transaction Amount",
];

// Bank exports commonly put several rows of letterhead/account-summary text before the real
// column headers — scan for the row that actually looks like one (has a date-ish header and an
// amount-ish header) instead of assuming row 1.
function findHeaderRowIndex(rawRows: string[][]): number {
  for (let i = 0; i < Math.min(rawRows.length, 50); i++) {
    const row = rawRows[i].map((v) => v.toLowerCase().replace(/\s+/g, " ").trim());
    const hasDate = DATE_HEADER_NAMES.some((name) => row.includes(name.toLowerCase()));
    const hasAmount = AMOUNT_HEADER_NAMES.some((name) => row.includes(name.toLowerCase()));
    if (hasDate && hasAmount) return i;
  }
  return 0;
}

// Parses a bank statement export (CSV, XLSX, or legacy XLS) into a flat list of transactions.
// Handles the two common export shapes: separate Credit/Debit columns, or a single signed
// Amount column (optionally paired with a Dr/Cr type column).
export async function parseBankStatement(buffer: Buffer, filename: string): Promise<BankTransaction[]> {
  const rawRows = await loadRawRows(buffer, filename);
  const rows = rowsToObjects(rawRows, findHeaderRowIndex(rawRows));
  const transactions: BankTransaction[] = [];

  for (const row of rows) {
    const dateStr = field(row, ...DATE_HEADER_NAMES);
    const date = parseFlexibleDate(dateStr);
    if (!date) continue;

    const description = field(row, "Description", "Narration", "Particulars", "Remarks", "Details", "Transaction Remarks");

    const credit = parseFlexibleNumber(field(row, "Credit", "Credit Amount", "Deposit", "Deposit Amt", "Deposit Amt.", "CR"));
    const debit = parseFlexibleNumber(field(row, "Debit", "Debit Amount", "Withdrawal", "Withdrawal Amt", "Withdrawal Amt.", "DR"));

    if (credit > 0) {
      transactions.push({ date: date.toISOString().slice(0, 10), description, amount: credit, direction: "CREDIT" });
      continue;
    }
    if (debit > 0) {
      transactions.push({ date: date.toISOString().slice(0, 10), description, amount: debit, direction: "DEBIT" });
      continue;
    }

    const amountStr = field(row, "Amount", "Transaction Amount").trim();
    if (!amountStr) continue;
    const isNegative = amountStr.startsWith("-");
    const magnitude = parseFlexibleNumber(amountStr.replace(/^-/, ""));
    if (magnitude === 0) continue;

    const typeStr = field(row, "Type", "Dr/Cr", "Cr/Dr").toUpperCase();
    let direction: "CREDIT" | "DEBIT";
    if (typeStr.includes("CR")) direction = "CREDIT";
    else if (typeStr.includes("DR")) direction = "DEBIT";
    else direction = isNegative ? "DEBIT" : "CREDIT";

    transactions.push({ date: date.toISOString().slice(0, 10), description, amount: magnitude, direction });
  }

  return transactions;
}
