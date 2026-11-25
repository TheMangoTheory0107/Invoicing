import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";
import { GeminiExtractError } from "@/lib/geminiExtract";
import { getCategories } from "@/lib/personal/categories";
import { buildReviewRows, type RawStatementTx } from "@/lib/personal/categorize";
import { geminiLabel, geminiReadStatement, parseSpreadsheetStatement } from "@/lib/personal/statement";

// A multi-page PDF statement read end-to-end by Gemini can take a minute or more.
export const maxDuration = 300;

const IMAGE_MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

// Reads an uploaded bank statement and returns rows with suggested categories for review.
// Nothing is saved here — the review screen posts the confirmed rows to /import/save.
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const buffer = Buffer.from(await file.arrayBuffer());
  const settings = await getSettings();
  const categories = await getCategories();
  const promptCats = categories.map((c) => ({ name: c.name, kind: c.kind, bucket: c.bucket }));
  const notes: string[] = [];

  let raw: RawStatementTx[] = [];
  try {
    if (ext === "pdf" || IMAGE_MIME[ext]) {
      if (!settings.geminiApiKey) {
        return NextResponse.json(
          { error: "Reading a PDF statement needs a Gemini API key — add one in Settings, or upload the Excel/CSV export of the statement instead." },
          { status: 400 }
        );
      }
      if (ext === "pdf" && buffer.includes(Buffer.from("/Encrypt"))) {
        return NextResponse.json(
          { error: "This PDF is password-protected. Open it, use Print → Save as PDF to make an unlocked copy, and upload that (or use the Excel export)." },
          { status: 400 }
        );
      }
      raw = await geminiReadStatement(
        { buffer, mimeType: ext === "pdf" ? "application/pdf" : IMAGE_MIME[ext] },
        promptCats,
        settings.geminiApiKey,
        settings.geminiModel
      );
    } else if (["csv", "xls", "xlsx"].includes(ext)) {
      raw = await parseSpreadsheetStatement(buffer, file.name);
      if (raw.length && settings.geminiApiKey) {
        try {
          raw = await geminiLabel(raw, promptCats, settings.geminiApiKey, settings.geminiModel);
        } catch (e) {
          notes.push(`AI labelling was skipped (${e instanceof Error ? e.message.slice(0, 160) : "error"}) — built-in merchant rules were used instead.`);
        }
      } else if (raw.length) {
        notes.push("No Gemini API key in Settings — used built-in merchant rules only, so more rows will need your input.");
      }
    } else {
      return NextResponse.json({ error: "Upload a PDF, Excel (.xls/.xlsx) or CSV statement." }, { status: 400 });
    }
  } catch (e) {
    if (e instanceof GeminiExtractError) return NextResponse.json({ error: e.message }, { status: 502 });
    throw e;
  }

  if (raw.length === 0) {
    return NextResponse.json(
      { error: "Couldn't find any transactions in that file. For Excel/CSV it needs a Date column and Withdrawal/Deposit (or Amount) columns." },
      { status: 400 }
    );
  }

  const rows = await buildReviewRows(raw);
  return NextResponse.json({ rows, notes });
}
