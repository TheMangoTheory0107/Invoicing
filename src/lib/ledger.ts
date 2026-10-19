import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { displayStatus } from "@/lib/status";

// One row per invoice — not a running bank-statement balance. "Balance" is always that
// invoice's own invoiced amount minus what's actually been settled against it, so it reads the
// same way the invoice detail page does: this invoice, this much owed. Multiple payments
// against one invoice are summed into a single "Settled" figure rather than listed as separate
// rows — the full payment-by-payment breakdown is one click away on the invoice itself.
export interface PartyInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: "SALES" | "PURCHASE" | "COMMISSION";
  date: Date;
  fy: string;
  month: string;
  status: string;
  invoiced: number;
  settled: number;
  tdsAmount: number;
  balance: number;
  paymentCount: number;
}

export const TYPE_LABEL: Record<string, string> = {
  SALES: "Sales invoice",
  COMMISSION: "Commission invoice",
  PURCHASE: "Purchase bill",
};

// A single party's full statement, one row per invoice. For a CLIENT the outstanding total is
// a receivable (what they owe us); for a CREATOR it's a payable (what we owe them) — same
// arithmetic either way, only the label differs.
export async function fetchPartyLedger(partyId: string) {
  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });

  const invoices = await prisma.invoice.findMany({
    where: party.type === "CLIENT" ? { clientId: partyId } : { creatorId: partyId },
    include: { payments: true },
    orderBy: { date: "asc" },
  });

  const rows: PartyInvoiceRow[] = invoices.map((inv) => {
    const invoiceType = inv.type as "SALES" | "PURCHASE" | "COMMISSION";
    const invoiced = toNumber(inv.totalAmount);
    const settled = toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted);
    const status = displayStatus(inv.status, inv.dueDate, settled, invoiced);
    return {
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      invoiceType,
      date: inv.date,
      fy: inv.fy,
      month: inv.month,
      status,
      invoiced,
      settled,
      tdsAmount: toNumber(inv.tdsDeducted),
      balance: invoiced - settled,
      paymentCount: inv.payments.length,
    };
  });

  const totals = invoices.reduce(
    (acc, inv) => {
      acc.invoiced += toNumber(inv.totalAmount);
      acc.received += toNumber(inv.amountPaid);
      acc.tds += toNumber(inv.tdsDeducted);
      return acc;
    },
    { invoiced: 0, received: 0, tds: 0 }
  );
  const outstanding = totals.invoiced - totals.received - totals.tds;

  return { party, rows, totals, outstanding };
}

export interface PartyBalance {
  id: string;
  name: string;
  type: "CLIENT" | "CREATOR";
  invoiced: number;
  outstanding: number;
}

// All parties with a nonzero lifetime invoiced amount, and their current outstanding balance —
// the debtors/creditors summary.
export async function fetchAllPartyBalances(): Promise<PartyBalance[]> {
  const parties = await prisma.party.findMany({
    include: {
      salesInvoices: { where: { type: { in: ["SALES", "COMMISSION"] } } },
      purchaseInvoices: true,
    },
  });

  const balances: PartyBalance[] = [];
  for (const p of parties) {
    const invoices = p.type === "CLIENT" ? p.salesInvoices : p.purchaseInvoices;
    if (invoices.length === 0) continue;
    const invoiced = invoices.reduce((s, i) => s + toNumber(i.totalAmount), 0);
    const settled = invoices.reduce((s, i) => s + toNumber(i.amountPaid) + toNumber(i.tdsDeducted), 0);
    balances.push({
      id: p.id,
      name: p.name,
      type: p.type as "CLIENT" | "CREATOR",
      invoiced,
      outstanding: invoiced - settled,
    });
  }

  return balances.sort((a, b) => b.outstanding - a.outstanding);
}
