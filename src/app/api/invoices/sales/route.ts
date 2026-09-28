import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { salesInvoiceSchema } from "@/lib/validation";
import { createSalesInvoice } from "@/lib/invoiceService";

export const dynamic = "force-dynamic";

export async function GET() {
  const invoices = await prisma.invoice.findMany({
    where: { type: "SALES" },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = salesInvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const { invoice, syncResult, driveSyncResult } = await createSalesInvoice(parsed.data);
    return NextResponse.json({ invoice, syncResult, driveSyncResult }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
