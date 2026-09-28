import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import { toCsv } from "@/lib/csv";
import { buildXlsxBuffer } from "@/lib/xlsx";
import { buildInvoiceWhere } from "@/lib/registerQuery";

export async function GET(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") === "purchase" ? "PURCHASE" : "SALES";
  const asXlsx = req.nextUrl.searchParams.get("format") === "xlsx";
  const filters = {
    fy: req.nextUrl.searchParams.get("fy") || undefined,
    month: req.nextUrl.searchParams.get("month") || undefined,
    status: req.nextUrl.searchParams.get("status") || undefined,
    q: req.nextUrl.searchParams.get("q") || undefined,
  };

  if (type === "SALES") {
    const invoices = await prisma.invoice.findMany({
      where: buildInvoiceWhere("SALES", filters, "client"),
      include: { client: true },
      orderBy: { date: "desc" },
    });
    const headers = ["Month", "Date", "Agency", "GST No.", "Bill no", "Bill Amount", "GST", "Total Amount", "Amount Paid", "TDS Deducted", "Balance", "Status"];
    const rows = invoices.map((inv) => [
      inv.month,
      formatDateDMY(inv.date),
      inv.client?.name || "",
      inv.client?.gstin || "",
      inv.number,
      toNumber(inv.billAmount),
      toNumber(inv.gstAmount),
      toNumber(inv.totalAmount),
      toNumber(inv.amountPaid),
      toNumber(inv.tdsDeducted),
      toNumber(inv.totalAmount) - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted),
      inv.status,
    ]);
    if (asXlsx) {
      const buffer = await buildXlsxBuffer("Sales Register", headers, rows);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="sales-register.xlsx"`,
        },
      });
    }
    return new NextResponse(toCsv(headers, rows), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="sales-register.csv"`,
      },
    });
  }

  const invoices = await prisma.invoice.findMany({
    where: buildInvoiceWhere("PURCHASE", filters, "creator"),
    include: { creator: true },
    orderBy: { date: "desc" },
  });
  const headers = ["Month", "Invoice sent date", "Name", "Invoice number", "Amount", "Amount Paid", "TDS Deducted", "Balance", "Status"];
  const rows = invoices.map((inv) => [
    inv.month,
    formatDateDMY(inv.date),
    inv.creator?.name || "",
    inv.number,
    toNumber(inv.totalAmount),
    toNumber(inv.amountPaid),
    toNumber(inv.tdsDeducted),
    toNumber(inv.totalAmount) - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted),
    inv.status,
  ]);
  if (asXlsx) {
    const buffer = await buildXlsxBuffer("Purchase Register", headers, rows);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="purchase-register.xlsx"`,
      },
    });
  }
  return new NextResponse(toCsv(headers, rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="purchase-register.csv"`,
    },
  });
}
