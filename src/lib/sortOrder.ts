import type { Prisma } from "@prisma/client";

// Shared "sort by invoice number" resolution — same three options everywhere: default newest
// first (by date), or by invoice number ascending/descending.
export function invoiceOrderBy(sort: string | undefined): Prisma.InvoiceOrderByWithRelationInput {
  if (sort === "number-asc") return { number: "asc" };
  if (sort === "number-desc") return { number: "desc" };
  return { date: "desc" };
}
