import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { appendTdsTrackerRow, SheetSyncError } from "@/lib/googleSheets";
import type { SheetSyncConfig } from "@prisma/client";

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

async function writeTdsTrackerRow(
  config: Pick<SheetSyncConfig, "tdsSpreadsheetId" | "serviceAccountJson">,
  params: { creatorName: string; panNo: string | null; date: Date; amount: number; tdsAmount: number }
): Promise<TdsSyncResult> {
  const { creatorName, panNo, date, amount, tdsAmount } = params;
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

// Appends a row to the TDS tracker workbook (a separate spreadsheet from the Sales/Commission/
// Purchase Register) right when a creator payment withholds TDS — not just once the bill is
// fully paid, since TDS is remitted per payment, not per invoice. A no-op (never throws) if TDS
// tracking isn't configured, or this particular payment withheld no TDS. On success, marks the
// payment as synced so the catch-up sweep below never writes a second row for it.
export async function syncPaymentToTdsTracker(
  paymentId: string,
  params: { creatorName: string; panNo: string | null; date: Date; amount: number; tdsAmount: number }
): Promise<TdsSyncResult> {
  if (params.tdsAmount <= 0) return { attempted: false, ok: true };

  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config?.enabled || !config.tdsSpreadsheetId || !config.serviceAccountJson) {
    return { attempted: false, ok: true };
  }

  const result = await writeTdsTrackerRow(config, params);
  if (result.ok && result.attempted) {
    await prisma.payment.update({ where: { id: paymentId }, data: { tdsTrackerSyncedAt: new Date() } }).catch(() => {});
  }
  return result;
}

export interface TdsCatchUpResult {
  attempted: boolean;
  ok: boolean;
  checked: number;
  synced: number;
  errors: string[];
}

// Safety-net sweep: finds every creator (Purchase) payment that withheld TDS and hasn't been
// written to the tracker sheet yet — regardless of why (the live sync was off or unconfigured
// at the time, failed, or the payment came in through bank-import reconciliation rather than
// the payment form) — and writes each one now. Each success is marked immediately, so running
// this any number of times — including the daily automatic check and an on-demand click on the
// same day — can never produce a duplicate row: a payment already marked synced is simply never
// looked at again.
export async function catchUpTdsTracker(): Promise<TdsCatchUpResult> {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config?.enabled || !config.tdsSpreadsheetId || !config.serviceAccountJson) {
    return { attempted: false, ok: true, checked: 0, synced: 0, errors: [] };
  }

  const payments = await prisma.payment.findMany({
    where: { tdsAmount: { gt: 0 }, tdsTrackerSyncedAt: null, invoice: { type: "PURCHASE" } },
    include: { invoice: { include: { creator: true } } },
    orderBy: { date: "asc" },
  });

  let synced = 0;
  const errors: string[] = [];
  for (const payment of payments) {
    const result = await writeTdsTrackerRow(config, {
      creatorName: payment.invoice.creator?.name || "Unknown",
      panNo: payment.invoice.creator?.panNo || null,
      date: payment.date,
      amount: toNumber(payment.amount),
      tdsAmount: toNumber(payment.tdsAmount),
    });
    if (result.ok && result.attempted) {
      await prisma.payment.update({ where: { id: payment.id }, data: { tdsTrackerSyncedAt: new Date() } });
      synced++;
    } else if (!result.ok) {
      errors.push(`${payment.invoice.number}: ${result.error}`);
    }
  }

  return { attempted: true, ok: errors.length === 0, checked: payments.length, synced, errors };
}
