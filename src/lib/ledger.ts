import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { displayStatus } from "@/lib/status";

export interface LedgerEntry {
  date: Date;
  kind: "INVOICE" | "PAYMENT";
  label: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceType: "SALES" | "PURCHASE" | "COMMISSION";
  fy: string;
  month: string;
  invoiceStatus: string; // the parent invoice's status — carried onto its payment rows too, so filtering by status hides a fully-settled invoice's history together
  debit: number;
  credit: number;
  tdsAmount: number;
  balance: number;
}

const TYPE_LABEL: Record<string, string> = {
  SALES: "Sales invoice",
  COMMISSION: "Commission invoice",
  PURCHASE: "Purchase bill",
};

// A single party's full statement — every invoice raised/received and every payment against
// it, in date order, with a running balance. For a CLIENT the balance is a receivable (what
// they owe us); for a CREATOR it's a payable (what we owe them) — same arithmetic either way,
// only the label differs.
export async function fetchPartyLedger(partyId: string) {
  const party = await prisma.party.findUniqueOrThrow({ where: { id: partyId } });

  const invoices = await prisma.invoice.findMany({
    where: party.type === "CLIENT" ? { clientId: partyId } : { creatorId: partyId },
    include: { payments: { orderBy: { date: "asc" } } },
    orderBy: { date: "asc" },
  });

  const raw: Omit<LedgerEntry, "balance">[] = [];
  for (const inv of invoices) {
    const invoiceType = inv.type as "SALES" | "PURCHASE" | "COMMISSION";
    const invoiceStatus = displayStatus(
      inv.status,
      inv.dueDate,
      toNumber(inv.amountPaid) + toNumber(inv.tdsDeducted),
      toNumber(inv.totalAmount)
    );
    raw.push({
      date: inv.date,
      kind: "INVOICE",
      label: `${TYPE_LABEL[inv.type] || inv.type} ${inv.number}`,
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      invoiceType,
      fy: inv.fy,
      month: inv.month,
      invoiceStatus,
      debit: toNumber(inv.totalAmount),
      credit: 0,
      tdsAmount: 0,
    });
    for (const p of inv.payments) {
      raw.push({
        date: p.date,
        kind: "PAYMENT",
        label: `Payment — ${inv.number}${p.method ? ` (${p.method})` : ""}`,
        invoiceId: inv.id,
        invoiceNumber: inv.number,
        invoiceType,
        fy: inv.fy,
        month: inv.month,
        invoiceStatus,
        debit: 0,
        credit: toNumber(p.amount) + toNumber(p.tdsAmount),
        tdsAmount: toNumber(p.tdsAmount),
      });
    }
  }

  raw.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = 0;
  const rows: LedgerEntry[] = raw.map((e) => {
    running += e.debit - e.credit;
    return { ...e, balance: running };
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
