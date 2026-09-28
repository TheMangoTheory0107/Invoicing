import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import { buildMultiSheetXlsxBuffer } from "@/lib/xlsx";

// One workbook per month — Sales, Commission, and Purchase registers for that period, in the
// same column layout as the individual register exports, so it can go straight to the CA for
// GST filing without extra reformatting.
export async function GET(req: NextRequest) {
  const fy = req.nextUrl.searchParams.get("fy") || "";
  const month = req.nextUrl.searchParams.get("month") || "";
  if (!fy || !month) {
    return NextResponse.json({ error: "fy and month are required" }, { status: 400 });
  }

  const [sales, commission, purchase] = await Promise.all([
    prisma.invoice.findMany({ where: { type: "SALES", fy, month }, include: { client: true }, orderBy: { date: "asc" } }),
    prisma.invoice.findMany({ where: { type: "COMMISSION", fy, month }, include: { client: true }, orderBy: { date: "asc" } }),
    prisma.invoice.findMany({ where: { type: "PURCHASE", fy, month }, include: { creator: true }, orderBy: { date: "asc" } }),
  ]);

  const clientBilledHeaders = ["Month", "Date", "Agency", "GST No.", "Bill no", "Bill Amount", "GST", "Total Amount", "Amount Paid", "TDS Deducted", "Balance", "Status"];
  const clientBilledRow = (inv: (typeof sales)[number]) => [
    inv.month, formatDateDMY(inv.date), inv.client?.name || "", inv.client?.gstin || "", inv.number,
    toNumber(inv.billAmount), toNumber(inv.gstAmount), toNumber(inv.totalAmount),
    toNumber(inv.amountPaid), toNumber(inv.tdsDeducted),
    toNumber(inv.totalAmount) - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted), inv.status,
  ];

  const purchaseHeaders = ["Month", "Invoice sent date", "Name", "Invoice number", "Amount", "Amount Paid", "TDS Deducted", "Balance", "Status"];
  const purchaseRows = purchase.map((inv) => [
    inv.month, formatDateDMY(inv.date), inv.creator?.name || "", inv.number, toNumber(inv.totalAmount),
    toNumber(inv.amountPaid), toNumber(inv.tdsDeducted),
    toNumber(inv.totalAmount) - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted), inv.status,
  ]);

  if (sales.length === 0 && commission.length === 0 && purchase.length === 0) {
    return NextResponse.json({ error: `No invoices found for ${month} ${fy}.` }, { status: 404 });
  }

  const buffer = await buildMultiSheetXlsxBuffer([
    { name: "Sales Register", headers: clientBilledHeaders, rows: sales.map(clientBilledRow) },
    { name: "Commission Register", headers: clientBilledHeaders, rows: commission.map(clientBilledRow) },
    { name: "Purchase Register", headers: purchaseHeaders, rows: purchaseRows },
  ]);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="GST-filing-${month}-${fy}.xlsx"`,
    },
  });
}
