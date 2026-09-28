import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { allocateInvoiceNumber } from "@/lib/numbering";
import { financialYearFor, monthLabel, parseDateOnly, addDays } from "@/lib/fy";
import type { InvoicePdfData } from "@/lib/pdf/InvoiceDocument";
import { syncInvoiceToSheet, deleteInvoiceFromSheet } from "@/lib/sheetSync";
import { syncInvoiceToDrive, deleteInvoiceDriveFile } from "@/lib/driveSync";
import { renderInvoicePdf } from "@/lib/pdf/generate";
import { toNumber } from "@/lib/format";
import type { SalesInvoiceInput, PurchaseInvoiceInput } from "@/lib/validation";

type InvoiceWithRelationsForPdf = Awaited<ReturnType<typeof fetchInvoiceForPdf>>;

function fetchInvoiceForPdf(invoiceId: string) {
  return prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      client: true,
      creator: true,
      lineItems: { orderBy: { sortOrder: "asc" } },
      creators: { orderBy: { sortOrder: "asc" } },
    },
  });
}

// Builds the PDF-ready data for an invoice from a fresh DB read — shared by the save path
// (for the Sheets sync payload) and the on-demand /api/invoices/[id]/pdf route.
export async function buildInvoicePdfData(invoiceId: string): Promise<InvoicePdfData> {
  const invoice = await fetchInvoiceForPdf(invoiceId);
  const settings = await getSettings();
  return buildPdfDataFromInvoice(invoice, settings);
}

function buildPdfDataFromInvoice(
  invoice: InvoiceWithRelationsForPdf,
  settings: Awaited<ReturnType<typeof getSettings>>
): InvoicePdfData {

  const billedParty =
    invoice.type !== "PURCHASE"
      ? invoice.client
        ? {
            name: invoice.client.name,
            gstin: invoice.client.gstin,
            address: invoice.client.address,
            email: invoice.client.email,
            phone: invoice.client.phone,
          }
        : null
      : invoice.creator
        ? {
            name: invoice.creator.name,
            gstin: invoice.creator.gstin,
            address: invoice.creator.address,
            email: invoice.creator.email,
            phone: invoice.creator.phone,
          }
        : null;

  const paymentDetails =
    invoice.type !== "PURCHASE"
      ? {
          accName: settings.bankAccName,
          bankName: settings.bankName,
          accNo: settings.bankAccNo,
          ifsc: settings.ifsc,
          upiId: settings.upiId,
          pan: settings.pan,
        }
      : {
          accName: invoice.creator?.bankAccName || "",
          bankName: invoice.creator?.bankName || "",
          accNo: invoice.creator?.bankAccNo || "",
          ifsc: invoice.creator?.ifsc || "",
          upiId: invoice.creator?.upiId || "",
          pan: invoice.creator?.panNo || "",
        };

  const pdfData: InvoicePdfData = {
    type: invoice.type as "SALES" | "PURCHASE" | "COMMISSION",
    number: invoice.number,
    date: invoice.date.toISOString(),
    billingDate1: invoice.billingDate1?.toISOString() ?? null,
    billingDate2: invoice.billingDate2?.toISOString() ?? null,
    collaborationBrand: invoice.collaborationBrand,
    brandColor: settings.brandColor,
    logoPath: settings.logoPath,
    signaturePath: settings.signaturePath,
    company: {
      name: settings.companyName,
      addressLine1: settings.addressLine1,
      addressLine2: settings.addressLine2,
      addressLine3: settings.addressLine3,
      sacCode: settings.sacCode,
      gstin: settings.gstin,
    },
    paymentDetails,
    billedParty,
    creators: invoice.creators.map((c) => ({
      name: c.name,
      address: c.address,
      email: c.email,
      phone: c.phone,
      pageHandle: c.pageHandle,
      gstNumber: c.gstNumber,
      link1: c.link1,
      link2: c.link2,
    })),
    lineItems: invoice.lineItems.map((li) => ({
      description: li.description,
      link1: li.link1,
      link2: li.link2,
      qty: toNumber(li.qty),
      rate: toNumber(li.rate),
      amount: toNumber(li.amount),
    })),
    billAmount: toNumber(invoice.billAmount),
    gstAmount: toNumber(invoice.gstAmount),
    reimbursements: toNumber(invoice.reimbursements),
    totalAmount: toNumber(invoice.totalAmount),
    termsAndConditions: invoice.termsAndConditions,
    generatedAt: invoice.createdAt.toISOString(),
  };

  return pdfData;
}

// Re-derives amountPaid/status from a fresh read after mutation and attempts a Sheets sync
// plus a Drive PDF upload (both no-ops unless configured in Settings). Shared by both create
// and update paths. The PDF itself is otherwise generated on demand (see buildInvoicePdfData)
// rather than cached to disk — it's only rendered here, in memory, when Drive sync is on.
async function finalize(invoiceId: string) {
  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { client: true, creator: true, payments: true },
  });

  const syncResult = await syncInvoiceToSheet(invoice);

  const driveConfig = await prisma.sheetSyncConfig.findUnique({ where: { id: 1 } });
  let driveSyncResult = { attempted: false, ok: true } as Awaited<ReturnType<typeof syncInvoiceToDrive>>;
  // A Purchase bill that came from an uploaded vendor PDF skips this entirely: the original
  // file (uploaded separately via the extraction flow) is the record worth keeping in Drive,
  // not a second, Mango Theory-branded re-rendering of it. A manually-entered Purchase bill
  // (no upload) still gets this fallback PDF, since there's nothing else to file.
  const skipOwnPdf = invoice.type === "PURCHASE" && invoice.hasSourcePdf;
  if (!skipOwnPdf && driveConfig?.driveFolderId && driveConfig.serviceAccountJson) {
    // Rendering the PDF can throw (e.g. a bad Drive/PDF dependency in the deploy environment) —
    // that must never take down the invoice save itself, same as a Sheets/Drive API failure.
    try {
      const pdfData = await buildInvoicePdfData(invoiceId);
      const pdfBuffer = await renderInvoicePdf(pdfData);
      driveSyncResult = await syncInvoiceToDrive({
        type: invoice.type as "SALES" | "PURCHASE" | "COMMISSION",
        fy: invoice.fy,
        month: invoice.month,
        number: invoice.number,
        partyName: invoice.client?.name || invoice.creator?.name || "Unknown",
        pdfBuffer,
      });
      if (driveSyncResult.link) {
        await prisma.invoice.update({ where: { id: invoiceId }, data: { pdfPath: driveSyncResult.link } });
      }
    } catch (err) {
      driveSyncResult = {
        attempted: true,
        ok: false,
        error: err instanceof Error ? err.message : "Unexpected error rendering the invoice PDF.",
      };
    }
  }

  return { invoice, syncResult, driveSyncResult };
}

// Shared by Sales and Commission invoices — both are client-billed, same shape, same GST
// treatment; only the invoice type (and therefore the numbering series/prefix) differs.
async function createClientBilledInvoice(type: "SALES" | "COMMISSION", input: SalesInvoiceInput) {
  const date = parseDateOnly(input.date);
  const fy = financialYearFor(date);
  const month = monthLabel(date);
  const settings = await getSettings();
  const dueDate = input.dueDate ? parseDateOnly(input.dueDate) : addDays(date, settings.paymentTermsDays);

  const billAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const totalAmount = billAmount + input.gstAmount + input.reimbursements;

  const number = await allocateInvoiceNumber(type, fy);

  const invoice = await prisma.invoice.create({
    data: {
      type,
      number,
      fy,
      month,
      date,
      billingDate1: input.billingDate1 ? parseDateOnly(input.billingDate1) : null,
      billingDate2: input.billingDate2 ? parseDateOnly(input.billingDate2) : null,
      dueDate,
      clientId: input.clientId,
      collaborationBrand: input.collaborationBrand,
      billAmount,
      gstAmount: input.gstAmount,
      reimbursements: input.reimbursements,
      totalAmount,
      termsAndConditions: input.termsAndConditions,
      notes: input.notes,
      lineItems: {
        create: input.lineItems.map((li, i) => ({ ...li, sortOrder: i })),
      },
      creators: {
        create: input.creators.map((c, i) => ({ ...c, sortOrder: i })),
      },
    },
  });

  return finalize(invoice.id);
}

async function updateClientBilledInvoice(id: string, input: SalesInvoiceInput) {
  const date = parseDateOnly(input.date);
  const fy = financialYearFor(date);
  const month = monthLabel(date);
  const dueDate = input.dueDate ? parseDateOnly(input.dueDate) : null;

  const billAmount = input.lineItems.reduce((sum, li) => sum + li.amount, 0);
  const totalAmount = billAmount + input.gstAmount + input.reimbursements;

  await prisma.$transaction([
    prisma.lineItem.deleteMany({ where: { invoiceId: id } }),
    prisma.invoiceCreator.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: {
        fy,
        month,
        date,
        billingDate1: input.billingDate1 ? parseDateOnly(input.billingDate1) : null,
        billingDate2: input.billingDate2 ? parseDateOnly(input.billingDate2) : null,
        dueDate: dueDate ?? undefined,
        clientId: input.clientId,
        collaborationBrand: input.collaborationBrand,
        billAmount,
        gstAmount: input.gstAmount,
        reimbursements: input.reimbursements,
        totalAmount,
        termsAndConditions: input.termsAndConditions,
        notes: input.notes,
        lineItems: { create: input.lineItems.map((li, i) => ({ ...li, sortOrder: i })) },
        creators: { create: input.creators.map((c, i) => ({ ...c, sortOrder: i })) },
      },
    }),
  ]);

  return finalize(id);
}

export function createSalesInvoice(input: SalesInvoiceInput) {
  return createClientBilledInvoice("SALES", input);
}

export function updateSalesInvoice(id: string, input: SalesInvoiceInput) {
  return updateClientBilledInvoice(id, input);
}

export function createCommissionInvoice(input: SalesInvoiceInput) {
  return createClientBilledInvoice("COMMISSION", input);
}

export function updateCommissionInvoice(id: string, input: SalesInvoiceInput) {
  return updateClientBilledInvoice(id, input);
}

export async function createPurchaseInvoice(
  input: PurchaseInvoiceInput
) {
  const date = parseDateOnly(input.date);
  const fy = financialYearFor(date);
  const month = monthLabel(date);
  const settings = await getSettings();
  const dueDate = input.dueDate ? parseDateOnly(input.dueDate) : addDays(date, settings.paymentTermsDays);

  const totalAmount = input.billAmount + input.gstAmount + input.reimbursements;
  const number = await allocateInvoiceNumber("PURCHASE", fy);

  const invoice = await prisma.invoice.create({
    data: {
      type: "PURCHASE",
      number,
      fy,
      month,
      date,
      dueDate,
      creatorId: input.creatorId,
      billAmount: input.billAmount,
      gstAmount: input.gstAmount,
      reimbursements: input.reimbursements,
      totalAmount,
      termsAndConditions: input.termsAndConditions,
      notes: input.notes,
      linkedSalesInvoiceId: input.linkedSalesInvoiceId,
      vendorInvoiceNumber: input.vendorInvoiceNumber || null,
      hasSourcePdf: input.hasSourcePdf,
      lineItems: { create: input.lineItems.map((li, i) => ({ ...li, sortOrder: i })) },
    },
  });

  return finalize(invoice.id);
}

export async function updatePurchaseInvoice(id: string, input: PurchaseInvoiceInput) {
  const date = parseDateOnly(input.date);
  const fy = financialYearFor(date);
  const month = monthLabel(date);
  const dueDate = input.dueDate ? parseDateOnly(input.dueDate) : null;
  const totalAmount = input.billAmount + input.gstAmount + input.reimbursements;

  await prisma.$transaction([
    prisma.lineItem.deleteMany({ where: { invoiceId: id } }),
    prisma.invoice.update({
      where: { id },
      data: {
        fy,
        month,
        date,
        dueDate: dueDate ?? undefined,
        creatorId: input.creatorId,
        billAmount: input.billAmount,
        gstAmount: input.gstAmount,
        reimbursements: input.reimbursements,
        totalAmount,
        termsAndConditions: input.termsAndConditions,
        notes: input.notes,
        vendorInvoiceNumber: input.vendorInvoiceNumber || null,
        lineItems: { create: input.lineItems.map((li, i) => ({ ...li, sortOrder: i })) },
      },
    }),
  ]);

  return finalize(id);
}

// Deletes an invoice, and — if it was the most recently numbered one in its type+FY — rolls
// the counter back so the next invoice created reuses that number instead of leaving a gap.
// Deleting an older invoice still leaves a gap, deliberately: renumbering already-issued
// invoices isn't safe to do automatically, and matches normal practice of never reusing or
// renumbering a number once a later one has been issued.
export async function deleteInvoiceById(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice) return { syncResult: { attempted: false, ok: true }, driveSyncResult: { attempted: false, ok: true } };

  await prisma.invoice.delete({ where: { id } });
  const syncResult = await deleteInvoiceFromSheet(invoice);
  const driveSyncResult = invoice.pdfPath
    ? await deleteInvoiceDriveFile(invoice.pdfPath)
    : { attempted: false, ok: true };

  // Numbers are either "NNN/FY" (sequence first) or "PREFIX/FY/NNN" (sequence last) — the FY
  // segment always contains a dash (e.g. "26-27"), so the pure-digits segment is unambiguous.
  const seqPart = invoice.number.split("/").find((p) => /^\d+$/.test(p));
  if (!seqPart) return { syncResult, driveSyncResult };
  const seq = parseInt(seqPart, 10);

  const counter = await prisma.counter.findUnique({
    where: { type_fy: { type: invoice.type, fy: invoice.fy } },
  });
  if (counter && counter.lastNumber === seq) {
    await prisma.counter.update({
      where: { type_fy: { type: invoice.type, fy: invoice.fy } },
      data: { lastNumber: seq - 1 },
    });
  }
  return { syncResult, driveSyncResult };
}

// Generates one PURCHASE invoice per creator referenced on a SALES invoice, using the
// per-creator `amount` entered at sales-invoice creation time. Skips creators that already
// have a linked purchase bill for this sales invoice (idempotent).
export async function generatePurchaseBillsFromSalesInvoice(salesInvoiceId: string) {
  const sales = await prisma.invoice.findUniqueOrThrow({
    where: { id: salesInvoiceId },
    include: { creators: true },
  });
  if (sales.type !== "SALES") throw new Error("Not a sales invoice");

  const existingLinked = await prisma.invoice.findMany({
    where: { linkedSalesInvoiceId: salesInvoiceId },
    select: { creatorId: true },
  });
  const alreadyLinkedCreatorIds = new Set(existingLinked.map((i) => i.creatorId));

  const created: string[] = [];
  for (const c of sales.creators) {
    if (!c.partyId || alreadyLinkedCreatorIds.has(c.partyId)) continue;
    if (toNumber(c.amount) <= 0) continue;

    const result = await createPurchaseInvoice({
      creatorId: c.partyId,
      date: sales.date.toISOString().slice(0, 10),
      dueDate: null,
      billAmount: toNumber(c.amount),
      gstAmount: 0,
      reimbursements: 0,
      vendorInvoiceNumber: "",
      hasSourcePdf: false,
      lineItems: [
        {
          description: `Payout for ${sales.number}${sales.collaborationBrand ? ` — ${sales.collaborationBrand}` : ""}`,
          link1: c.link1 || "",
          link2: c.link2 || "",
          qty: 1,
          rate: toNumber(c.amount),
          amount: toNumber(c.amount),
        },
      ],
      termsAndConditions: "",
      notes: `Auto-generated from Sales invoice ${sales.number}`,
      linkedSalesInvoiceId: salesInvoiceId,
    });
    created.push(result.invoice.id);
  }
  return created;
}
