import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { backfillLinksAcrossInvoices, SheetSyncError } from "@/lib/googleSheets";

export const dynamic = "force-dynamic";
// Scans every tab in the spreadsheet once, which can take a while on a large workbook —
// give it real room instead of the platform's short default.
export const maxDuration = 60;

// One-time catch-up for every Sales/Commission invoice raised before this sync existed —
// writes Bill No + that line item's own amount into any monthly tab row whose Link matches,
// same as what now happens automatically on every new invoice. Safe to re-run: matching rows
// just get rewritten with the same value.
export async function POST() {
  const config = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  if (!config?.spreadsheetId || !config.serviceAccountJson) {
    return NextResponse.json(
      { error: "Set up the spreadsheet ID and service account in Settings → Google Sheets & Drive sync first." },
      { status: 400 }
    );
  }

  const invoices = await prisma.invoice.findMany({
    where: { type: { in: ["SALES", "COMMISSION"] } },
    include: { lineItems: true },
    orderBy: { date: "asc" },
  });

  const invoiceLinks = invoices
    .map((inv) => {
      const byLink = new Map<string, number>();
      for (const li of inv.lineItems) {
        const amount = toNumber(li.amount);
        if (li.link1?.trim()) byLink.set(li.link1.trim(), amount);
        if (li.link2?.trim()) byLink.set(li.link2.trim(), amount);
      }
      return { invoiceNumber: inv.number, links: Array.from(byLink, ([link, amount]) => ({ link, amount })) };
    })
    .filter((inv) => inv.links.length > 0);

  try {
    const result = await backfillLinksAcrossInvoices({
      serviceAccountJson: config.serviceAccountJson,
      spreadsheetId: config.spreadsheetId,
      invoices: invoiceLinks,
    });
    return NextResponse.json({
      ...result,
      invoicesChecked: invoices.length,
      invoicesWithLinks: invoiceLinks.length,
    });
  } catch (err) {
    const message = err instanceof SheetSyncError ? err.message : "Could not run the backfill.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
