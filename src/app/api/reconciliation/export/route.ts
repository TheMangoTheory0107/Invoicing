import { NextRequest, NextResponse } from "next/server";
import { toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import { toCsv } from "@/lib/csv";
import { buildXlsxBuffer } from "@/lib/xlsx";
import { fetchReconciliationRows } from "@/lib/reconciliation";

export async function GET(req: NextRequest) {
  const asXlsx = req.nextUrl.searchParams.get("format") === "xlsx";
  const filters = {
    from: req.nextUrl.searchParams.get("from") || undefined,
    to: req.nextUrl.searchParams.get("to") || undefined,
    type: req.nextUrl.searchParams.get("type") || undefined,
    status: req.nextUrl.searchParams.get("status") || undefined,
    q: req.nextUrl.searchParams.get("q") || undefined,
  };

  const invoices = await fetchReconciliationRows(filters);
  const headers = ["Date", "Type", "Number", "Party", "Total", "Paid", "TDS Deducted", "Balance", "Status"];
  const rows = invoices.map((inv) => {
    const total = toNumber(inv.totalAmount);
    const paid = toNumber(inv.amountPaid);
    const tds = toNumber(inv.tdsDeducted);
    return [
      formatDateDMY(inv.date),
      inv.type,
      inv.number,
      inv.client?.name || inv.creator?.name || "",
      total,
      paid,
      tds,
      total - paid - tds,
      inv.status,
    ];
  });

  if (asXlsx) {
    const buffer = await buildXlsxBuffer("Reconciliation", headers, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reconciliation.xlsx"`,
      },
    });
  }

  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="reconciliation.csv"`,
    },
  });
}
