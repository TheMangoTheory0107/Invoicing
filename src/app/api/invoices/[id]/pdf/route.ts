import { NextRequest, NextResponse } from "next/server";
import { buildInvoicePdfData } from "@/lib/invoiceService";
import { renderInvoicePdf } from "@/lib/pdf/generate";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  let pdfData;
  try {
    pdfData = await buildInvoicePdfData(params.id);
  } catch {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const buffer = await renderInvoicePdf(pdfData);
  const partyName = (pdfData.billedParty?.name || "invoice").replace(/[\/\\:*?"<>|]/g, "").trim();
  const fileName = `${partyName}-${pdfData.number.replace(/\//g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
    },
  });
}
