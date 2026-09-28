import { z } from "zod";

export const partySchema = z.object({
  type: z.enum(["CLIENT", "CREATOR"]),
  name: z.string().min(1, "Name is required"),
  gstin: z.string().optional().default(""),
  panNo: z.string().optional().default(""),
  address: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  pageHandle: z.string().optional().default(""),
  bankAccName: z.string().optional().default(""),
  bankName: z.string().optional().default(""),
  bankAccNo: z.string().optional().default(""),
  ifsc: z.string().optional().default(""),
  upiId: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export type PartyInput = z.infer<typeof partySchema>;

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  link1: z.string().optional().default(""),
  link2: z.string().optional().default(""),
  qty: z.coerce.number().default(1),
  rate: z.coerce.number().default(0),
  amount: z.coerce.number().default(0),
});

export const invoiceCreatorSchema = z.object({
  partyId: z.string().optional().nullable(),
  name: z.string().min(1, "Creator name is required"),
  address: z.string().optional().default(""),
  email: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  pageHandle: z.string().optional().default(""),
  gstNumber: z.string().optional().default(""),
  link1: z.string().optional().default(""),
  link2: z.string().optional().default(""),
  amount: z.coerce.number().default(0),
});

export const salesInvoiceSchema = z.object({
  clientId: z.string().min(1, "Client is required"),
  date: dateOnly,
  dueDate: dateOnly.optional().nullable(),
  poNumber: z.string().optional().default(""),
  collaborationBrand: z.string().optional().default(""),
  creators: z.array(invoiceCreatorSchema).default([]),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
  gstAmount: z.coerce.number().default(0),
  reimbursements: z.coerce.number().default(0),
  termsAndConditions: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const purchaseInvoiceSchema = z.object({
  creatorId: z.string().min(1, "Creator is required"),
  date: dateOnly,
  dueDate: dateOnly.optional().nullable(),
  billAmount: z.coerce.number().min(0),
  gstAmount: z.coerce.number().default(0),
  reimbursements: z.coerce.number().default(0),
  lineItems: z.array(lineItemSchema).default([]),
  termsAndConditions: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  linkedSalesInvoiceId: z.string().optional().nullable(),
  vendorInvoiceNumber: z.string().optional().default(""),
  hasSourcePdf: z.boolean().optional().default(false),
});

export type SalesInvoiceInput = z.infer<typeof salesInvoiceSchema>;
export type PurchaseInvoiceInput = z.infer<typeof purchaseInvoiceSchema>;
