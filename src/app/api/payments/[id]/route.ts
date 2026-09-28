import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeInvoiceStatus } from "@/lib/payments";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const payment = await prisma.payment.findUnique({ where: { id: params.id } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.payment.delete({ where: { id: params.id } });
  const { invoice, syncResult } = await recomputeInvoiceStatus(payment.invoiceId);
  return NextResponse.json({ invoice, syncResult });
}
