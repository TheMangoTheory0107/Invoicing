import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/fy";
import { recomputeInvoiceStatus } from "@/lib/payments";
import { syncPaymentToTdsTracker } from "@/lib/tdsSync";

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

  // TDS is remitted to the government per payment, not per invoice — so the tracker gets a row
  // every time a creator payment withholds TDS, not just once the bill is fully paid.
  const tdsSyncResult =
    updated.type === "PURCHASE" && parsed.data.tdsAmount > 0
      ? await syncPaymentToTdsTracker({
          creatorName: updated.creator?.name || "Unknown",
          panNo: updated.creator?.panNo || null,
          date: parseDateOnly(parsed.data.date),
          amount: parsed.data.amount,
          tdsAmount: parsed.data.tdsAmount,
        })
      : { attempted: false, ok: true };

  return NextResponse.json({ invoice: updated, syncResult, tdsSyncResult }, { status: 201 });
}
