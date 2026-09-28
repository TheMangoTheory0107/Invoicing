import type { Prisma } from "@prisma/client";
import { startOfTodayUTC } from "@/lib/status";

export interface RegisterFilters {
  fy?: string;
  month?: string;
  status?: string; // "" | UNPAID | PARTIAL | PAID | OVERDUE
  q?: string;
}

export function buildInvoiceWhere(
  type: "SALES" | "COMMISSION" | "PURCHASE",
  filters: RegisterFilters,
  partyField: "client" | "creator"
): Prisma.InvoiceWhereInput {
  const where: Prisma.InvoiceWhereInput = { type };

  if (filters.fy) where.fy = filters.fy;
  if (filters.month) where.month = filters.month;

  if (filters.status === "OVERDUE") {
    where.status = { not: "PAID" };
    where.dueDate = { lt: startOfTodayUTC() };
  } else if (filters.status) {
    where.status = filters.status;
  }

  if (filters.q) {
    where[partyField] = { name: { contains: filters.q } };
  }

  return where;
}
