import { prisma } from "@/lib/prisma";
import { buildInvoiceNumber } from "@/lib/fy";

const PREFIX: Partial<Record<"SALES" | "PURCHASE" | "COMMISSION", string>> = {
  COMMISSION: "COM",
};

// Atomically allocates the next invoice number for a given type + financial year.
// Uses an upsert so concurrent requests can't hand out the same number.
export async function allocateInvoiceNumber(
  type: "SALES" | "PURCHASE" | "COMMISSION",
  fy: string
): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { type_fy: { type, fy } },
    create: { type, fy, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });
  return buildInvoiceNumber(counter.lastNumber, fy, PREFIX[type]);
}
