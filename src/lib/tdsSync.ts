import { prisma } from "@/lib/prisma";
import { appendTdsTrackerRow, SheetSyncError } from "@/lib/googleSheets";

export interface TdsSyncResult {
  attempted: boolean;
  ok: boolean;
  error?: string;
}

// This business's creator payments only ever fall into one of three TDS sections — 194J
// (professional fees, 10%), 194H (commission, 2%), 194C (contract work, 1%). Rather than adding
// a new field to Party/Invoice for this, the section is derived straight from the rate actually
// withheld: TDS is deducted from the gross bill at a fixed percentage per section, so that
// percentage alone identifies which one applies. `payment.amount` is the net cash paid (after
// TDS), so the gross bill TDS was computed on is amount + tdsAmount.
const SECTION_BY_RATE_PERCENT: Record<number, string> = { 10: "194J", 2: "194H", 1: "194C" };

function sectionForRate(tdsAmount: number, grossAmount: number): { code: string; ratePercent: number } | null {
  if (grossAmount <= 0) return null;
  const ratePercent = Math.round((tdsAmount / grossAmount) * 100);
  const code = SECTION_BY_RATE_PERCENT[ratePercent];
  return code ? { code, ratePercent } : null;
}

// Appends a row to the TDS tracker workbook (a separate spreadsheet from the Sales/Commission/
// Purchase Register) every time a creator payment withholds TDS — not just once the bill is
// fully paid, since TDS is remitted per payment, not per invoice. A no-op (never throws) if TDS
// tracking isn't configured, or if this particular payment didn't withhold any TDS at all.
export async function syncPaymentToTdsTracker(params: {
  creatorName: string;
  panNo: string | null;
  date: Date;
  amount: number;
  tdsAmount: number;
}): Promise<TdsSyncResult> {
  const { creatorName, panNo, date, amount, tdsAmount } = params;
  if (tdsAmount <= 0) return { attempted: false, ok: true };

  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config?.enabled || !config.tdsSpreadsheetId || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }

  const grossAmount = amount + tdsAmount;
  const section = sectionForRate(tdsAmount, grossAmount);

  try {
    await appendTdsTrackerRow({
      serviceAccountJson: config.serviceAccountJson,
      spreadsheetId: config.tdsSpreadsheetId,
      date,
      particulars: creatorName,
      panNo: panNo || "",
      sectionCode: section?.code || "",
      tdsRate: section ? `${section.ratePercent}%` : "",
      total: grossAmount,
    });
    return { attempted: true, ok: true };
  } catch (err) {
    const message =
      err instanceof SheetSyncError ? err.message : err instanceof Error ? err.message : "Could not write to the TDS tracker sheet.";
    return { attempted: true, ok: false, error: message };
  }
}
