import { parseUploadedFile, field, parseFlexibleDate, parseFlexibleNumber } from "@/lib/importRegister";

export interface BankTransaction {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // always positive
  direction: "CREDIT" | "DEBIT";
}

// Parses a bank statement export (CSV or XLSX) into a flat list of transactions. Handles the
// two common export shapes: separate Credit/Debit columns, or a single signed Amount column
// (optionally paired with a Dr/Cr type column).
export async function parseBankStatement(buffer: Buffer, filename: string): Promise<BankTransaction[]> {
  const rows = await parseUploadedFile(buffer, filename);
  const transactions: BankTransaction[] = [];

  for (const row of rows) {
    const dateStr = field(row, "Date", "Txn Date", "Transaction Date", "Value Date", "Post Date");
    const date = parseFlexibleDate(dateStr);
    if (!date) continue;

    const description = field(row, "Description", "Narration", "Particulars", "Remarks", "Details", "Transaction Remarks");

    const credit = parseFlexibleNumber(field(row, "Credit", "Credit Amount", "Deposit", "CR"));
    const debit = parseFlexibleNumber(field(row, "Debit", "Debit Amount", "Withdrawal", "DR"));

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
