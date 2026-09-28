import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { salesInvoiceSchema, purchaseInvoiceSchema } from "@/lib/validation";
import {
  updateSalesInvoice,
  updatePurchaseInvoice,
  updateCommissionInvoice,
  deleteInvoiceById,
} from "@/lib/invoiceService";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      client: true,
      creator: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      creators: { orderBy: { sortOrder: "asc" } },
      payments: { orderBy: { date: "desc" } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const existing = await prisma.invoice.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  try {
    if (existing.type === "SALES" || existing.type === "COMMISSION") {
      const parsed = salesInvoiceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const { invoice, syncResult, driveSyncResult } =
        existing.type === "COMMISSION"
          ? await updateCommissionInvoice(params.id, parsed.data)
          : await updateSalesInvoice(params.id, parsed.data);
      return NextResponse.json({ invoice, syncResult, driveSyncResult });
    } else {
      const parsed = purchaseInvoiceSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }
      const { invoice, syncResult, driveSyncResult } = await updatePurchaseInvoice(params.id, parsed.data);
      return NextResponse.json({ invoice, syncResult, driveSyncResult });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save invoice.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { syncResult, driveSyncResult } = await deleteInvoiceById(params.id);
  return NextResponse.json({ ok: true, syncResult, driveSyncResult });
}
