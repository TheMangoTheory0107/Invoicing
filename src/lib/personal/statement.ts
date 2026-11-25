import { loadRawRows, parseFlexibleDate, parseFlexibleNumber } from "@/lib/importRegister";
import { callGeminiJson } from "@/lib/geminiExtract";
import type { RawStatementTx } from "./categorize";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// Bank exports use every date style under the sun: 01.11.2026, 01-11-2026, 01/11/26,
// 01-Nov-2026, 01 Nov 2026, 2026-11-01, Excel ISO. Always treated as DD-first (Indian banks).
export function parseStatementDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const named = /^(\d{1,2})[\s\-/.]([A-Za-z]{3,9})[\s\-/.,]+(\d{2}|\d{4})/.exec(v);
  if (named) {
    const m = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    if (m >= 0) {
      const y = named[3].length === 2 ? 2000 + +named[3] : +named[3];
      return new Date(Date.UTC(y, m, +named[1])).toISOString().slice(0, 10);
    }
  }
  const dotted = /^(\d{1,2})[.\-](\d{1,2})[.\-](\d{2}|\d{4})(\s|$)/.exec(v);
  if (dotted) {
    const y = dotted[3].length === 2 ? 2000 + +dotted[3] : +dotted[3];
    return new Date(Date.UTC(y, +dotted[2] - 1, +dotted[1])).toISOString().slice(0, 10);
  }
  const d = parseFlexibleDate(v.split(" ")[0]) || parseFlexibleDate(v);
  return d ? d.toISOString().slice(0, 10) : null;
}

type ColRole = "date" | "desc" | "debit" | "credit" | "amount" | "type";

function roleFor(header: string): ColRole | null {
  const h = header.toLowerCase().replace(/\s+/g, " ").trim();
  if (!h) return null;
  if (/value date/.test(h)) return null; // prefer the transaction date column
  if (/\bdate\b/.test(h)) return "date";
  if (/(remark|narration|description|particular|details)/.test(h)) return "desc";
  if (/(withdrawal|debit|^dr\b|paid out|money out)/.test(h)) return "debit";
  if (/(deposit|credit|^cr\b|paid in|money in)/.test(h)) return "credit";
  if (/^(dr ?\/ ?cr|cr ?\/ ?dr|type)$/.test(h)) return "type";
  if (/amount/.test(h) && !/balance/.test(h)) return "amount";
  return null;
}

// Local (no-AI) reader for CSV/XLS/XLSX statement exports. Scans for the header row, maps
// columns by fuzzy name ("Withdrawal Amount (INR)", "Debit", "Dr" …), then reads every row
// that has a valid date and an amount.
export async function parseSpreadsheetStatement(buffer: Buffer, filename: string): Promise<RawStatementTx[]> {
  const raw = await loadRawRows(buffer, filename);
  let headerIdx = -1;
  let cols: Partial<Record<ColRole, number>> = {};
  for (let i = 0; i < Math.min(raw.length, 60); i++) {
    const found: Partial<Record<ColRole, number>> = {};
    (raw[i] || []).forEach((cell, idx) => {
      const role = roleFor(cell || "");
      if (role && found[role] === undefined) found[role] = idx;
    });
    if (found.date !== undefined && (found.debit !== undefined || found.credit !== undefined || found.amount !== undefined)) {
      headerIdx = i;
      cols = found;
      break;
    }
  }
  if (headerIdx < 0) return [];

  const out: RawStatementTx[] = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const row = raw[i] || [];
    const date = parseStatementDate(row[cols.date!] || "");
    if (!date) continue;
    const description = (cols.desc !== undefined ? row[cols.desc] : "")?.replace(/\s+/g, " ").trim() || "";
    const debit = cols.debit !== undefined ? Math.abs(parseFlexibleNumber(row[cols.debit] || "")) : 0;
    const credit = cols.credit !== undefined ? Math.abs(parseFlexibleNumber(row[cols.credit] || "")) : 0;
    if (debit > 0) {
      out.push({ date, description, amount: debit, direction: "DEBIT" });
    } else if (credit > 0) {
      out.push({ date, description, amount: credit, direction: "CREDIT" });
    } else if (cols.amount !== undefined) {
      const s = (row[cols.amount] || "").trim();
      const n = parseFlexibleNumber(s.replace(/^-/, "").replace(/(dr|cr)$/i, ""));
      if (!n) continue;
      const type = `${cols.type !== undefined ? row[cols.type] : ""} ${s}`.toUpperCase();
      const direction = /\bCR\b|CR$/.test(type) ? "CREDIT" : /\bDR\b|DR$/.test(type) || s.startsWith("-") ? "DEBIT" : "CREDIT";
      out.push({ date, description, amount: Math.abs(n), direction });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------------------------

export interface CategoryForPrompt {
  name: string;
  kind: string;
  bucket: string;
}

function categoryListText(categories: CategoryForPrompt[]) {
  return categories
    .map((c) => `- ${c.name} (${c.kind === "EXPENSE" ? `expense, ${c.bucket.toLowerCase()}` : c.kind.toLowerCase()})`)
    .join("\n");
}

const LABELLING_RULES = `Labelling rules:
- category must be EXACTLY one of the category names listed, or an empty string if you genuinely can't tell.
- merchant: a short clean payee name, e.g. "Zomato", "Blinkit", "Urban Company", or a person's name in Title Case ("Raza Aminu").
- Indian bank narrations: "UPI/<payee>/<vpa>/<note>/<bank>/<ref>". Known brands are easy (Zomato/Swiggy = Food Delivery, Zepto/Blinkit = Groceries, Myntra = Shopping, "MUTUAL FUN"/Groww/Zerodha = an Investment, CRED = Credit Card Bill, Netflix/Spotify = Subscriptions).
- Investments (SIP, mutual funds, stocks, FD, PPF, NPS, gold) are NOT expenses — use an investment category.
- Paying your own credit-card bill or moving money between your own accounts is a Transfer, not an expense.
- confidence "high" only when the payee is a recognisable business whose category is obvious. Payments to an individual person's UPI ID (names like "Asharaf P", "Kulye Ravi", "Mr Shubham"), unknown shop names, or large unusual amounts are "low" — the user will be asked.
- question: when confidence is "low", write ONE short, friendly question for the user that helps them label it, mentioning the amount and payee, and a guess if you have one — e.g. "₹50 to Asharaf P (paid often, small amounts) — tea/snacks stall, or something else?". Empty string when confidence is "high".`;

const TX_ITEM_PROPS = {
  merchant: { type: "STRING" },
  category: { type: "STRING" },
  confidence: { type: "STRING", enum: ["high", "low"] },
  question: { type: "STRING" },
};

interface GeminiStatementTx {
  date: string;
  description: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  merchant: string;
  category: string;
  confidence: "high" | "low";
  question: string;
}

// Reads a PDF (or scanned image) bank statement end-to-end with Gemini: every transaction
// row, plus a suggested label for each, in one call.
export async function geminiReadStatement(
  file: { buffer: Buffer; mimeType: string },
  categories: CategoryForPrompt[],
  apiKey: string,
  model: string
): Promise<RawStatementTx[]> {
  const prompt = `This is a personal bank account statement (likely from an Indian bank). Extract EVERY transaction row, across all pages, in order. Skip opening/closing balance lines, page headers/footers and legends.

For each transaction:
- date: YYYY-MM-DD (statements are DD-MM-YYYY / DD.MM.YYYY — day first).
- description: the full transaction remarks/narration text joined onto one line.
- amount: the withdrawal or deposit amount as a positive number (NOT the running balance).
- direction: "DEBIT" for a withdrawal/money out, "CREDIT" for a deposit/money in.
- merchant, category, confidence, question: per the labelling rules below.

Categories available:
${categoryListText(categories)}

${LABELLING_RULES}`;

  const schema = {
    type: "OBJECT",
    properties: {
      transactions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING" },
            description: { type: "STRING" },
            amount: { type: "NUMBER" },
            direction: { type: "STRING", enum: ["DEBIT", "CREDIT"] },
            ...TX_ITEM_PROPS,
          },
          required: ["date", "description", "amount", "direction", "merchant", "category", "confidence", "question"],
        },
      },
    },
    required: ["transactions"],
  };

  const result = await callGeminiJson<{ transactions: GeminiStatementTx[] }>({
    parts: [{ text: prompt }, { inline_data: { mime_type: file.mimeType, data: file.buffer.toString("base64") } }],
    schema,
    apiKey,
    model,
    timeoutMs: 120000,
  });

  return (result.transactions || [])
    .map((t) => ({
      date: parseStatementDate(t.date) || "",
      description: (t.description || "").replace(/\s+/g, " ").trim(),
      amount: Math.abs(Number(t.amount) || 0),
      direction: t.direction === "CREDIT" ? ("CREDIT" as const) : ("DEBIT" as const),
      merchant: t.merchant,
      suggestedCategory: t.category,
      confidence: t.confidence,
      question: t.question,
    }))
    .filter((t) => t.date && t.amount > 0);
}

// Labels already-parsed transactions (from a CSV/Excel export) — text only, batched.
export async function geminiLabel(
  txs: RawStatementTx[],
  categories: CategoryForPrompt[],
  apiKey: string,
  model: string
): Promise<RawStatementTx[]> {
  const BATCH = 80;
  const out = txs.map((t) => ({ ...t }));
  for (let start = 0; start < txs.length; start += BATCH) {
    const batch = txs.slice(start, start + BATCH);
    const lines = batch
      .map((t, i) => `${i}\t${t.date}\t${t.direction}\t${t.amount}\t${t.description}`)
      .join("\n");
    const prompt = `Label these personal bank transactions (index, date, direction, amount ₹, narration):

${lines}

Categories available:
${categoryListText(categories)}

${LABELLING_RULES}

Return one entry per input line, with its index.`;
    const schema = {
      type: "OBJECT",
      properties: {
        labels: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { index: { type: "INTEGER" }, ...TX_ITEM_PROPS },
            required: ["index", "merchant", "category", "confidence", "question"],
          },
        },
      },
      required: ["labels"],
    };
    const result = await callGeminiJson<{
      labels: { index: number; merchant: string; category: string; confidence: "high" | "low"; question: string }[];
    }>({ parts: [{ text: prompt }], schema, apiKey, model, timeoutMs: 60000 });
    for (const l of result.labels || []) {
      const target = out[start + l.index];
      if (!target || l.index < 0 || l.index >= batch.length) continue;
      target.merchant = l.merchant;
      target.suggestedCategory = l.category;
      target.confidence = l.confidence;
      target.question = l.question;
    }
  }
  return out;
}
