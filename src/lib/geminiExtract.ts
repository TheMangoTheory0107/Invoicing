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

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GeminiExtractError(
      `Gemini API request failed (${res.status}). Check the API key in Settings is valid. ${body.slice(0, 300)}`
    );
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
