import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { KEYWORD_RULES } from "./categories";

export interface RawStatementTx {
  date: string; // yyyy-mm-dd
  description: string;
  amount: number; // positive
  direction: "DEBIT" | "CREDIT";
  merchant?: string;
  // Optional hints from Gemini
  suggestedCategory?: string;
  confidence?: "high" | "low";
  question?: string;
}

export interface ReviewRow {
  date: string;
  description: string;
  merchant: string;
  merchantKey: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  categoryId: string | null;
  // How the suggestion was made — shown as a little tag in the review screen.
  via: "rule" | "keyword" | "ai" | "none";
  needsReview: boolean;
  question: string;
  importHash: string;
  duplicate: boolean;
}

// "UPI/ZEPTO MARK/XX.rzp@mairtel/Sent using/..." → "ZEPTO MARK"
// "UPI-ZOMATO-zomato@hdfcbank-..." → "ZOMATO"
// Falls back to the first few words of the narration.
export function extractMerchant(description: string): string {
  const d = description.replace(/\s+/g, " ").trim();
  for (const sep of ["/", "-"]) {
    const parts = d.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 3 && /^(upi|neft|imps|rtgs|pos|ach|nach|bil|mmt|inft|vps|ips|onl)$/i.test(parts[0])) {
      // NEFT/IMPS often go TYPE/REF/NAME — skip a pure reference number.
      const candidate = /^[A-Z0-9]{8,}$/i.test(parts[1]) && /\d/.test(parts[1]) ? parts[2] : parts[1];
      if (candidate && !candidate.includes("@")) return titleCase(candidate);
    }
  }
  return titleCase(d.split(" ").slice(0, 3).join(" ").slice(0, 40));
}

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s; // already mixed case — leave it alone
  return s.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function merchantKey(merchant: string): string {
  return merchant
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(pvt|private|ltd|limited|llp|inc|india|in|technologies|tech)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const KEYWORD_MATCHERS = KEYWORD_RULES.map((r) => ({
  category: r.category,
  re: new RegExp(`(?<![a-z0-9])(${r.keywords.map(escapeRegex).join("|")})(?![a-z0-9])`, "i"),
}));

export function keywordCategory(text: string): string | null {
  for (const m of KEYWORD_MATCHERS) if (m.re.test(text)) return m.category;
  return null;
}

// A stable fingerprint for dedupe across re-imports. Prefer the bank's own 12-digit UPI/IMPS
// reference number when there is one (robust to Gemini re-wording the narration); otherwise
// fall back to the normalized narration.
export function computeImportHash(tx: { date: string; amount: number; direction: string; description: string }, occurrence: number) {
  const ref = tx.description.match(/(?<!\d)\d{12}(?!\d)/)?.[0];
  const key = ref || tx.description.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 80);
  const base = `${tx.date}|${tx.amount.toFixed(2)}|${tx.direction}|${key}|${occurrence}`;
  return createHash("sha1").update(base).digest("hex");
}

export async function buildReviewRows(raw: RawStatementTx[]): Promise<ReviewRow[]> {
  const [categories, rules] = await Promise.all([
    prisma.personalCategory.findMany({ where: { archived: false } }),
    prisma.personalMerchantRule.findMany(),
  ]);
  const byName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));
  const ruleMap = new Map(rules.map((r) => [r.pattern, r.categoryId]));
  const validIds = new Set(categories.map((c) => c.id));

  const seen = new Map<string, number>();
  const rows: ReviewRow[] = raw.map((tx) => {
    const merchant = (tx.merchant || "").trim() || extractMerchant(tx.description);
    const mKey = merchantKey(merchant);

    const occKey = `${tx.date}|${tx.amount}|${tx.direction}|${tx.description}`;
    const occurrence = seen.get(occKey) || 0;
    seen.set(occKey, occurrence + 1);
    const importHash = computeImportHash(tx, occurrence);

    let categoryId: string | null = null;
    let via: ReviewRow["via"] = "none";
    let needsReview = true;
    let question = "";

    const ruleCat = ruleMap.get(mKey);
    const kwName = keywordCategory(`${merchant} ${tx.description}`);
    const kwCat = kwName ? byName.get(kwName.toLowerCase()) : undefined;
    const aiCat = tx.suggestedCategory ? byName.get(tx.suggestedCategory.toLowerCase()) : undefined;

    if (ruleCat && validIds.has(ruleCat)) {
      categoryId = ruleCat;
      via = "rule";
      needsReview = false;
    } else if (kwCat) {
      categoryId = kwCat.id;
      via = "keyword";
      needsReview = false;
    } else if (aiCat) {
      categoryId = aiCat.id;
      via = "ai";
      needsReview = tx.confidence !== "high";
      question = tx.question || "";
    }

    if (needsReview && !question) {
      question =
        tx.direction === "DEBIT"
          ? `₹${tx.amount.toLocaleString("en-IN")} paid to ${merchant} — what was this for?`
          : `₹${tx.amount.toLocaleString("en-IN")} received from ${merchant} — what was this?`;
    }

    return {
      date: tx.date,
      description: tx.description,
      merchant,
      merchantKey: mKey,
      amount: tx.amount,
      direction: tx.direction,
      categoryId,
      via,
      needsReview,
      question,
      importHash,
      duplicate: false,
    };
  });

  const existing = await prisma.personalTransaction.findMany({
    where: { importHash: { in: rows.map((r) => r.importHash) } },
    select: { importHash: true },
  });
  const existingSet = new Set(existing.map((e) => e.importHash));
  for (const r of rows) r.duplicate = existingSet.has(r.importHash);
  return rows;
}
