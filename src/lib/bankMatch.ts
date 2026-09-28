import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import type { BankTransaction } from "@/lib/bankImport";

// Common TDS sections applied to invoices in this business: 194C (contractors, 1-2%), 194H
// (commission, 5%), 194J (professional fees, 10%), plus a 20% no-PAN fallback.
const TDS_RATES = [0.01, 0.02, 0.05, 0.1, 0.2];

export interface MatchCandidate {
  invoiceId: string;
  number: string;
  partyName: string;
  type: string;
  remainingBalance: number;
  tdsAmount: number;
  label: string;
  diff: number;
}

// A bank credit matches an outstanding Sales/Commission invoice (client paying us); a debit
// matches an outstanding Purchase bill (us paying a creator). Either can arrive net of TDS, so
// beyond an exact-balance match this also checks "remaining balance minus common TDS rates on
// the base amount" and surfaces the closest few guesses for the user to confirm — never applied
// automatically, since amount-only matching can be wrong when two invoices happen to be close.
export async function findCandidateMatches(tx: BankTransaction): Promise<MatchCandidate[]> {
  const types = tx.direction === "CREDIT" ? ["SALES", "COMMISSION"] : ["PURCHASE"];
  const invoices = await prisma.invoice.findMany({
    where: { type: { in: types }, status: { not: "PAID" } },
    include: { client: true, creator: true },
    orderBy: { date: "desc" },
    take: 500,
  });

  const tolerance = Math.max(1, tx.amount * 0.01);
  const candidates: MatchCandidate[] = [];

  for (const inv of invoices) {
    const total = toNumber(inv.totalAmount);
    const remaining = total - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted);
    if (remaining <= 0.01) continue;
    const bill = toNumber(inv.billAmount);
    const partyName = inv.client?.name || inv.creator?.name || "—";

    const exactDiff = Math.abs(remaining - tx.amount);
    if (exactDiff <= tolerance) {
      candidates.push({
        invoiceId: inv.id,
        number: inv.number,
        partyName,
        type: inv.type,
        remainingBalance: remaining,
        tdsAmount: 0,
        label: "Full balance",
        diff: exactDiff,
      });
      continue; // an exact match is decisive for this invoice — skip TDS guesses for it
    }

    let best: MatchCandidate | null = null;
    for (const rate of TDS_RATES) {
      const impliedTds = bill * rate;
      const expected = remaining - impliedTds;
      if (expected <= 0) continue;
      const diff = Math.abs(expected - tx.amount);
      if (diff <= tolerance && (!best || diff < best.diff)) {
        best = {
          invoiceId: inv.id,
          number: inv.number,
          partyName,
          type: inv.type,
          remainingBalance: remaining,
          tdsAmount: impliedTds,
          label: `Balance minus ${(rate * 100).toFixed(0)}% TDS`,
          diff,
        };
      }
    }
    if (best) candidates.push(best);
  }

  return candidates.sort((a, b) => a.diff - b.diff).slice(0, 8);
}
