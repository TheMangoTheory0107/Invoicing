export class GeminiExtractError extends Error {}

// Used only if Settings has no model saved yet (shouldn't normally happen — the column has
// its own default) — kept here as a last-resort fallback, not the source of truth.
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export interface ExtractedPurchaseBill {
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD, may be empty
  vendorName: string;
  vendorAddress: string;
  vendorGstin: string;
  vendorPan: string;
  vendorBankAccName: string;
  vendorBankName: string;
  vendorBankAccNo: string;
  vendorIfsc: string;
  vendorUpiId: string;
  billAmount: number;
  gstAmount: number;
  totalAmount: number;
  lineItems: { description: string; qty: number; rate: number; amount: number }[];
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    invoiceNumber: { type: "STRING" },
    invoiceDate: { type: "STRING", description: "YYYY-MM-DD" },
    dueDate: { type: "STRING", description: "YYYY-MM-DD, empty string if not stated" },
    vendorName: { type: "STRING" },
    vendorAddress: { type: "STRING" },
    vendorGstin: { type: "STRING" },
    vendorPan: { type: "STRING" },
    vendorBankAccName: { type: "STRING", description: "Bank account holder name for payment, if stated" },
    vendorBankName: { type: "STRING" },
    vendorBankAccNo: { type: "STRING" },
    vendorIfsc: { type: "STRING" },
    vendorUpiId: { type: "STRING" },
    billAmount: { type: "NUMBER", description: "Taxable value before GST" },
    gstAmount: { type: "NUMBER" },
    totalAmount: { type: "NUMBER" },
    lineItems: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          description: { type: "STRING" },
          qty: { type: "NUMBER" },
          rate: { type: "NUMBER" },
          amount: { type: "NUMBER" },
        },
        required: ["description", "amount"],
      },
    },
  },
  required: ["invoiceNumber", "invoiceDate", "vendorName", "billAmount", "gstAmount", "totalAmount"],
};

const PROMPT = `This document is a tax invoice/bill sent to us by a vendor (a content creator or agency being paid for services). Extract the fields as JSON matching the schema exactly.

- billAmount is the taxable value BEFORE GST. If the document only shows a GST-inclusive total plus a GST amount, compute billAmount = total - GST.
- Dates must be formatted YYYY-MM-DD. If a due date isn't stated, use an empty string.
- lineItems should list each billed item/service with its description, quantity, rate, and amount — if the invoice has no item-level breakdown, return a single line item summarizing the whole bill with qty 1 and rate/amount equal to billAmount.
- Also look for the vendor's own bank payment details, often in a footer or a "Payment Details" / "Bank Details" box: account holder name, bank name, account number, IFSC code, and UPI ID. Extract whichever of these are present.
- If a field genuinely isn't present anywhere on the document, use an empty string (for text fields) or 0 (for numbers) rather than guessing.`;

export type PurchaseBillSource =
  | { kind: "pdf"; buffer: Buffer }
  | { kind: "text"; content: string };

// Google has repeatedly retired model IDs out from under this app (gemini-2.5-flash, then
// gemini-2.0-flash both went from "works" to 404 "no longer available" with no warning), and
// even the current one spikes into 503 "high demand" for stretches at a time on the free tier.
// Retrying the SAME model just waits out the same problem twice. Instead, a 404/429/503 moves
// on to the next model in this chain — a different model is a different capacity pool and
// (for 404) simply a different, still-valid model ID — so one bad/overloaded model no longer
// means a dead end. Update this list if Google deprecates one of these too.
const FALLBACK_MODELS = ["gemini-3.5-flash-lite", "gemini-3.8-flash"];
const MODEL_FALLBACK_STATUSES = [404, 429, 503];
const PER_ATTEMPT_TIMEOUT_MS = 18000;

function buildModelChain(configured: string): string[] {
  return Array.from(new Set([configured, ...FALLBACK_MODELS]));
}

async function callGeminiOnce(url: string, body: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiAcrossModels(
  apiKey: string,
  models: string[],
  body: string
): Promise<{ res: Response; modelUsed: string }> {
  let last: { res: Response; modelUsed: string } | null = null;
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await callGeminiOnce(url, body);
      if (res.ok || !MODEL_FALLBACK_STATUSES.includes(res.status)) {
        return { res, modelUsed: model };
      }
      last = { res, modelUsed: model };
    } catch {
      // Timed out — treat the same as a fallback-worthy failure and move to the next model.
    }
  }
  if (last) return last;
  throw new GeminiExtractError(
    `Gemini timed out on every model tried (${models.join(", ")}) — likely a sustained outage. Try again shortly.`
  );
}

export async function extractPurchaseBill(
  source: PurchaseBillSource,
  apiKey: string,
  model: string = DEFAULT_GEMINI_MODEL
): Promise<ExtractedPurchaseBill> {
  if (!apiKey) {
    throw new GeminiExtractError("No Gemini API key configured — add one in Settings first.");
  }

  const parts =
    source.kind === "pdf"
      ? [
          { text: PROMPT },
          { inline_data: { mime_type: "application/pdf", data: source.buffer.toString("base64") } },
        ]
      : [
          {
            text: `${PROMPT}\n\nHere is the bill's content, as plain text extracted from a spreadsheet/CSV file:\n\n${source.content}`,
          },
        ];

  const models = buildModelChain(model);
  const { res, modelUsed } = await callGeminiAcrossModels(
    apiKey,
    models,
    JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
      },
    })
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const triedNote = MODEL_FALLBACK_STATUSES.includes(res.status)
      ? ` Tried ${models.length > 1 ? `${models.length} models (${models.join(", ")})` : modelUsed} — all unavailable right now, try again shortly.`
      : " Check the API key in Settings is valid.";
    throw new GeminiExtractError(`Gemini API request failed (${res.status}) on ${modelUsed}.${triedNote} ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new GeminiExtractError("Gemini didn't return any extracted data for this file.");
  }

  try {
    return JSON.parse(text) as ExtractedPurchaseBill;
  } catch {
    throw new GeminiExtractError("Gemini's response wasn't valid JSON — try again.");
  }
}
