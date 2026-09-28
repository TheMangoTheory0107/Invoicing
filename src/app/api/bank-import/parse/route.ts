import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";
import { parseBankStatement } from "@/lib/bankImport";
import { findCandidateMatches } from "@/lib/bankMatch";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const transactions = await parseBankStatement(buffer, file.name);
  if (transactions.length === 0) {
    return NextResponse.json(
      {
        error:
          "Couldn't find any transactions in that file — it needs Date and Description columns, plus either Credit/Debit columns or an Amount column.",
      },
      { status: 400 }
    );
  }

  const rows = [];
  for (const tx of transactions) {
    const candidates = await findCandidateMatches(tx);
    rows.push({ ...tx, candidates });
  }

  const openInvoices = await prisma.invoice.findMany({
    where: { status: { not: "PAID" } },
    include: { client: true, creator: true },
    orderBy: { date: "desc" },
    take: 300,
  });

  return NextResponse.json({
    rows,
    openInvoices: openInvoices.map((inv) => ({
      id: inv.id,
      number: inv.number,
      type: inv.type,
      partyName: inv.client?.name || inv.creator?.name || "—",
      remainingBalance: toNumber(inv.totalAmount) - toNumber(inv.amountPaid) - toNumber(inv.tdsDeducted),
    })),
  });
}
