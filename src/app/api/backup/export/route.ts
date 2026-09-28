import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { formatDateDMY } from "@/lib/fy";
import { buildMultiSheetXlsxBuffer } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

// Full-data export — every client, creator, invoice (all three types), and payment, as one
// workbook. Not a database restore tool, but a real offline copy you control, independent of
// Turso's own backups — for when "what if I lose everything" needs a concrete answer.
export async function GET() {
  const [clients, creators, sales, commission, purchase, payments] = await Promise.all([
    prisma.party.findMany({ where: { type: "CLIENT" }, orderBy: { name: "asc" } }),
    prisma.party.findMany({ where: { type: "CREATOR" }, orderBy: { name: "asc" } }),
    prisma.invoice.findMany({ where: { type: "SALES" }, include: { client: true }, orderBy: { date: "asc" } }),
    prisma.invoice.findMany({ where: { type: "COMMISSION" }, include: { client: true }, orderBy: { date: "asc" } }),
    prisma.invoice.findMany({ where: { type: "PURCHASE" }, include: { creator: true }, orderBy: { date: "asc" } }),
    prisma.payment.findMany({ include: { invoice: true }, orderBy: { date: "asc" } }),
  ]);

  const partyHeaders = ["Name", "GSTIN", "PAN", "Address", "Email", "Phone", "Bank A/c Name", "Bank Name", "Bank A/c No", "IFSC", "UPI ID", "Notes"];
  const partyRow = (p: (typeof clients)[number]) => [
    p.name, p.gstin || "", p.panNo || "", p.address || "", p.email || "", p.phone || "",
    p.bankAccName || "", p.bankName || "", p.bankAccNo || "", p.ifsc || "", p.upiId || "", p.notes || "",
  ];

  const clientBilledHeaders = [
    "Number", "FY", "Date", "Due Date", "Party", "GSTIN", "Collaboration Brand",
    "Bill Amount", "GST", "Reimbursements", "Total", "Status", "Amount Paid", "TDS Deducted",
  ];
  const clientBilledRow = (inv: (typeof sales)[number]) => [
    inv.number, inv.fy, formatDateDMY(inv.date), inv.dueDate ? formatDateDMY(inv.dueDate) : "",
    inv.client?.name || "", inv.client?.gstin || "", inv.collaborationBrand || "",
    toNumber(inv.billAmount), toNumber(inv.gstAmount), toNumber(inv.reimbursements), toNumber(inv.totalAmount),
    inv.status, toNumber(inv.amountPaid), toNumber(inv.tdsDeducted),
  ];

  const purchaseHeaders = [
    "Number", "FY", "Date", "Due Date", "Creator", "Bill Amount", "GST", "Reimbursements",
    "Total", "Status", "Amount Paid", "TDS Deducted",
  ];
  const purchaseRows = purchase.map((inv) => [
    inv.number, inv.fy, formatDateDMY(inv.date), inv.dueDate ? formatDateDMY(inv.dueDate) : "",
    inv.creator?.name || "", toNumber(inv.billAmount), toNumber(inv.gstAmount), toNumber(inv.reimbursements),
    toNumber(inv.totalAmount), inv.status, toNumber(inv.amountPaid), toNumber(inv.tdsDeducted),
  ]);

  const paymentHeaders = ["Invoice Number", "Invoice Type", "Date", "Amount", "TDS Amount", "Method", "Reference", "Notes"];
  const paymentRows = payments.map((p) => [
    p.invoice.number, p.invoice.type, formatDateDMY(p.date), toNumber(p.amount), toNumber(p.tdsAmount),
    p.method || "", p.reference || "", p.notes || "",
  ]);

  const buffer = await buildMultiSheetXlsxBuffer([
    { name: "Clients", headers: partyHeaders, rows: clients.map(partyRow) },
    { name: "Creators", headers: partyHeaders, rows: creators.map(partyRow) },
    { name: "Sales Invoices", headers: clientBilledHeaders, rows: sales.map(clientBilledRow) },
    { name: "Commission Invoices", headers: clientBilledHeaders, rows: commission.map(clientBilledRow) },
    { name: "Purchase Bills", headers: purchaseHeaders, rows: purchaseRows },
    { name: "Payments", headers: paymentHeaders, rows: paymentRows },
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="mango-theory-backup-${stamp}.xlsx"`,
    },
  });
}
