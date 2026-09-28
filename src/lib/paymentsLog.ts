import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/fy";

export interface PaymentsLogFilters {
  from?: string;
  to?: string;
  type?: string; // "" | SALES | COMMISSION | PURCHASE
  q?: string;
}

export function buildPaymentsLogWhere(filters: PaymentsLogFilters): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = {};
  const invoiceWhere: Prisma.InvoiceWhereInput = {};

  if (filters.type === "SALES" || filters.type === "COMMISSION" || filters.type === "PURCHASE") {
    invoiceWhere.type = filters.type;
  }

  if (filters.q) {
    invoiceWhere.OR = [
      { client: { name: { contains: filters.q } } },
      { creator: { name: { contains: filters.q } } },
    ];
  }

  if (Object.keys(invoiceWhere).length > 0) where.invoice = invoiceWhere;

  if (filters.from || filters.to) {
    where.date = {};
    if (filters.from) where.date.gte = parseDateOnly(filters.from);
    if (filters.to) where.date.lte = parseDateOnly(filters.to);
  }

  return where;
}

// Every individual payment transaction, across all invoice types, newest first — a running
// log for doing the books without opening each invoice one at a time.
export async function fetchPaymentsLog(filters: PaymentsLogFilters) {
  return prisma.payment.findMany({
    where: buildPaymentsLogWhere(filters),
    include: { invoice: { include: { client: true, creator: true } } },
    orderBy: { date: "desc" },
  });
}
