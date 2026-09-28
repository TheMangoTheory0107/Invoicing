import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { purchaseInvoiceSchema } from "@/lib/validation";
import { createPurchaseInvoice } from "@/lib/invoiceService";

export const dynamic = "force-dynamic";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    where: { type: "PURCHASE" },
    include: { creator: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = purchaseInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { invoice, syncResult, driveSyncResult } = await createPurchaseInvoice(parsed.data);
    return NextResponse.json({ invoice, syncResult, driveSyncResult }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create bill.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
