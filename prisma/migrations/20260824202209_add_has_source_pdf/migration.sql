-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "fy" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "billingDate1" DATETIME,
    "billingDate2" DATETIME,
    "month" TEXT NOT NULL,
    "dueDate" DATETIME,
    "clientId" TEXT,
    "creatorId" TEXT,
    "collaborationBrand" TEXT,
    "billAmount" DECIMAL NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL NOT NULL DEFAULT 0,
    "reimbursements" DECIMAL NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "amountPaid" DECIMAL NOT NULL DEFAULT 0,
    "tdsDeducted" DECIMAL NOT NULL DEFAULT 0,
    "termsAndConditions" TEXT,
    "notes" TEXT,
    "pdfPath" TEXT,
    "vendorInvoiceNumber" TEXT,
    "hasSourcePdf" BOOLEAN NOT NULL DEFAULT false,
    "linkedSalesInvoiceId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Party" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountPaid", "billAmount", "billingDate1", "billingDate2", "clientId", "collaborationBrand", "createdAt", "creatorId", "date", "dueDate", "fy", "gstAmount", "id", "linkedSalesInvoiceId", "month", "notes", "number", "pdfPath", "reimbursements", "status", "tdsDeducted", "termsAndConditions", "totalAmount", "type", "updatedAt", "vendorInvoiceNumber") SELECT "amountPaid", "billAmount", "billingDate1", "billingDate2", "clientId", "collaborationBrand", "createdAt", "creatorId", "date", "dueDate", "fy", "gstAmount", "id", "linkedSalesInvoiceId", "month", "notes", "number", "pdfPath", "reimbursements", "status", "tdsDeducted", "termsAndConditions", "totalAmount", "type", "updatedAt", "vendorInvoiceNumber" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_type_fy_idx" ON "Invoice"("type", "fy");
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");
CREATE INDEX "Invoice_month_fy_idx" ON "Invoice"("month", "fy");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
