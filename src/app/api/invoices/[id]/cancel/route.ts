import { NextRequest, NextResponse } from "next/server";
import { setInvoiceCancelled, CancelInvoiceError } from "@/lib/cancelInvoice";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { cancel } = await req.json().catch(() => ({ cancel: true }));
  try {
    const { invoice, syncResult } = await setInvoiceCancelled(params.id, !!cancel);
    return NextResponse.json({ invoice, syncResult });
  } catch (err) {
    const message = err instanceof CancelInvoiceError ? err.message : "Could not update this invoice's status.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
