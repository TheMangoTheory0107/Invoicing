import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import InvoiceDocument, { type InvoicePdfData } from "./InvoiceDocument";

// Renders the invoice PDF to a buffer on demand — nothing is written to disk, so this
// works the same whether running locally or on serverless/ephemeral hosting.
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} /> as ReactElement<DocumentProps>);
}
