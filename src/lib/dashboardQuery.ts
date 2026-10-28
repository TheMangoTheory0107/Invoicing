import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

export interface DashboardFilters {
  fy?: string;
  month?: string;
  sort?: string; // "" | "number-asc" | "number-desc"
}

export function buildPeriodWhere(filters: DashboardFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};
  if (filters.fy) where.fy = filters.fy;
  if (filters.month) where.month = filters.month;
  return where;
}

// Turnover and costs are pre-GST (billAmount) — GST collected/paid is money passed through to
// the government, not real revenue or real cost, so it's excluded to keep "profit" meaningful.
export async function fetchBusinessOverview(filters: DashboardFilters) {
  const periodWhere = buildPeriodWhere(filters);

  const [sales, commission, purchase] = await Promise.all([
    prisma.invoice.findMany({
      where: { ...periodWhere, type: "SALES", status: { not: "CANCELLED" } },
      select: { billAmount: true },
    }),
    prisma.invoice.findMany({
      where: { ...periodWhere, type: "COMMISSION", status: { not: "CANCELLED" } },
      select: { billAmount: true },
    }),
    prisma.invoice.findMany({
      where: { ...periodWhere, type: "PURCHASE", status: { not: "CANCELLED" } },
      select: { billAmount: true },
    }),
  ]);

  const salesTurnover = sales.reduce((s, i) => s + toNumber(i.billAmount), 0);
  const commissionTurnover = commission.reduce((s, i) => s + toNumber(i.billAmount), 0);
  const turnover = salesTurnover + commissionTurnover;
  const costs = purchase.reduce((s, i) => s + toNumber(i.billAmount), 0);
  const profit = turnover - costs;
  const profitMargin = turnover > 0 ? (profit / turnover) * 100 : 0;

  return {
    turnover,
    salesTurnover,
    commissionTurnover,
    costs,
    profit,
    profitMargin,
    invoiceCount: sales.length + commission.length + purchase.length,
  };
}

export async function fetchDashboardInvoices(filters: DashboardFilters) {
  const where = buildPeriodWhere(filters);
  const orderBy: Prisma.InvoiceOrderByWithRelationInput =
    filters.sort === "number-asc"
      ? { number: "asc" }
      : filters.sort === "number-desc"
        ? { number: "desc" }
        : { date: "desc" };

  return prisma.invoice.findMany({
    where,
    include: { client: true, creator: true },
    orderBy,
  });
}
