import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/fy";
import { startOfTodayUTC } from "@/lib/status";

export interface ReconciliationFilters {
  from?: string;
  to?: string;
  type?: string; // "" | SALES | COMMISSION | PURCHASE
  status?: string; // "" | UNPAID | PARTIAL | PAID | OVERDUE
  q?: string;
}

export function buildReconciliationWhere(filters: ReconciliationFilters): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = {};

  if (filters.type === "SALES" || filters.type === "COMMISSION" || filters.type === "PURCHASE") {
    where.type = filters.type;
  }

  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = parseDateOnly(filters.from);
    if (filters.to) where.date.lte = parseDateOnly(filters.to);
  }

  if (filters.status === "OVERDUE") {
    where.status = { not: "PAID" };
    where.dueDate = { lt: startOfTodayUTC() };
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.q) {
    where.OR = [
      { client: { name: { contains: filters.q } } },
      { creator: { name: { contains: filters.q } } },
    ];
  }

  return where;
}

export async function fetchReconciliationRows(filters: ReconciliationFilters) {
  return prisma.invoice.findMany({
    where: buildReconciliationWhere(filters),
    include: { client: true, creator: true },
    orderBy: { date: "desc" },
  });
}
