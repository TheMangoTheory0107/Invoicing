import { NextRequest, NextResponse } from "next/server";
import { generatePurchaseBillsFromSalesInvoice } from "@/lib/invoiceService";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const created = await generatePurchaseBillsFromSalesInvoice(params.id);
    return NextResponse.json({ created });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not generate purchase bills.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
