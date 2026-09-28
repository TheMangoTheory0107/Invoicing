/*
  Warnings:

  - You are about to drop the column `serviceAccountJsonPath` on the `SheetSyncConfig` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "companyName" TEXT NOT NULL DEFAULT 'TheMangoTheory',
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
    "termsAndConditions" TEXT NOT NULL DEFAULT 'Payment is due within the agreed timeline from the date of this invoice. Kindly make payment to the bank details below and share the payment reference for our records. For any questions regarding this invoice, please get in touch with us.',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "storagePath" TEXT NOT NULL DEFAULT './storage/invoices',
    "brandColor" TEXT NOT NULL DEFAULT '#134F5C',
    "logoPath" TEXT
);
INSERT INTO "new_Settings" ("addressLine1", "addressLine2", "addressLine3", "bankAccName", "bankAccNo", "bankName", "brandColor", "companyName", "gstin", "id", "ifsc", "logoPath", "pan", "paymentTermsDays", "sacCode", "storagePath", "termsAndConditions", "upiId") SELECT "addressLine1", "addressLine2", "addressLine3", "bankAccName", "bankAccNo", "bankName", "brandColor", "companyName", "gstin", "id", "ifsc", "logoPath", "pan", "paymentTermsDays", "sacCode", "storagePath", "termsAndConditions", "upiId" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE TABLE "new_SheetSyncConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "spreadsheetId" TEXT NOT NULL DEFAULT '',
    "salesSheetName" TEXT NOT NULL DEFAULT 'Sales Register',
    "purchaseSheetName" TEXT NOT NULL DEFAULT 'Purchase Register',
    "commissionSheetName" TEXT NOT NULL DEFAULT 'Commission Register',
    "serviceAccountJson" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_SheetSyncConfig" ("enabled", "id", "purchaseSheetName", "salesSheetName", "spreadsheetId") SELECT "enabled", "id", "purchaseSheetName", "salesSheetName", "spreadsheetId" FROM "SheetSyncConfig";
DROP TABLE "SheetSyncConfig";
ALTER TABLE "new_SheetSyncConfig" RENAME TO "SheetSyncConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
