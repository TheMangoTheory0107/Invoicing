import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/fy";
import { recomputeInvoiceStatus } from "@/lib/payments";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.coerce.number().positive(),
  tdsAmount: z.coerce.number().min(0).optional().default(0),
  method: z.string().optional().default(""),
  reference: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!invoice) return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  if (invoice.status === "CANCELLED") {
    return NextResponse.json({ error: "This invoice is cancelled — reactivate it before recording a payment." }, { status: 400 });
  }

  await prisma.payment.create({
    data: {
      invoiceId: params.id,
      date: parseDateOnly(parsed.data.date),
      amount: parsed.data.amount,
      tdsAmount: parsed.data.tdsAmount,
      method: parsed.data.method,
      reference: parsed.data.reference,
      notes: parsed.data.notes,
    },
  });

  const { invoice: updated, syncResult } = await recomputeInvoiceStatus(params.id);
  return NextResponse.json({ invoice: updated, syncResult }, { status: 201 });
}
