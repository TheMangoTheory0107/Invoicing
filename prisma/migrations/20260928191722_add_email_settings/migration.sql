-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'THE MANGO THEORY',
    "addressLine1" TEXT NOT NULL DEFAULT '',
    "addressLine2" TEXT NOT NULL DEFAULT '',
    "addressLine3" TEXT NOT NULL DEFAULT '',
    "sacCode" TEXT NOT NULL DEFAULT '',
    "gstin" TEXT NOT NULL DEFAULT '',
    "pan" TEXT NOT NULL DEFAULT '',
    "bankAccName" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccNo" TEXT NOT NULL DEFAULT '',
    "ifsc" TEXT NOT NULL DEFAULT '',
    "upiId" TEXT NOT NULL DEFAULT '',
    "termsAndConditions" TEXT NOT NULL DEFAULT '1. GST under Reverse Charge Mechanism: GST is not payable under the Reverse Charge Mechanism (RCM).
2. Payment Terms: Payment must be made in full on or before the due date specified in the invoice. In the event of delayed payment, interest at the rate of 24% per annum may be charged on the outstanding amount from the due date until the date of actual payment.
3. Cheque Return Charges: In the event of a bank cheque being returned or dishonoured, the recipient/customer shall be liable to pay Rs. 500/- towards cheque return and related bank charges.
4. TDS Deduction: Where applicable, TDS may be deducted at the rate of 2% under Section 194C of the Income Tax Act, 1961, calculated on the taxable value of the invoice, excluding the Goods and Services Tax (GST) component. The applicable TDS certificate shall be provided by the recipient/customer within the prescribed period.
5. Amendment of Terms: We reserve the right to modify, amend, or update these Terms & Conditions from time to time without prior notice. The revised terms shall be applicable from the date of such amendment.',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "storagePath" TEXT NOT NULL DEFAULT './storage/invoices',
    "brandColor" TEXT NOT NULL DEFAULT '#134F5C',
    "logoPath" TEXT,
    "signaturePath" TEXT,
    "geminiApiKey" TEXT NOT NULL DEFAULT '',
    "geminiModel" TEXT NOT NULL DEFAULT 'gemini-3.6-flash',
    "emailFromAddress" TEXT NOT NULL DEFAULT '',
    "emailAppPassword" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("addressLine1", "addressLine2", "addressLine3", "bankAccName", "bankAccNo", "bankName", "brandColor", "companyName", "geminiApiKey", "geminiModel", "gstin", "id", "ifsc", "logoPath", "pan", "paymentTermsDays", "sacCode", "signaturePath", "storagePath", "termsAndConditions", "upiId") SELECT "addressLine1", "addressLine2", "addressLine3", "bankAccName", "bankAccNo", "bankName", "brandColor", "companyName", "geminiApiKey", "geminiModel", "gstin", "id", "ifsc", "logoPath", "pan", "paymentTermsDays", "sacCode", "signaturePath", "storagePath", "termsAndConditions", "upiId" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
