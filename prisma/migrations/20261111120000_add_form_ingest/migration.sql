-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "formSubmissionFileId" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SheetSyncConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "spreadsheetId" TEXT NOT NULL DEFAULT '',
    "salesSheetName" TEXT NOT NULL DEFAULT 'Sales Register',
    "purchaseSheetName" TEXT NOT NULL DEFAULT 'Purchase Register',
    "commissionSheetName" TEXT NOT NULL DEFAULT 'Commission Register',
    "serviceAccountJson" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "driveFolderId" TEXT NOT NULL DEFAULT '',
    "formResponsesSpreadsheetId" TEXT NOT NULL DEFAULT '',
    "formResponsesSheetName" TEXT NOT NULL DEFAULT 'Form Responses 1',
    "formResponsesImpersonate" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_SheetSyncConfig" ("commissionSheetName", "driveFolderId", "enabled", "id", "purchaseSheetName", "salesSheetName", "serviceAccountJson", "spreadsheetId") SELECT "commissionSheetName", "driveFolderId", "enabled", "id", "purchaseSheetName", "salesSheetName", "serviceAccountJson", "spreadsheetId" FROM "SheetSyncConfig";
DROP TABLE "SheetSyncConfig";
ALTER TABLE "new_SheetSyncConfig" RENAME TO "SheetSyncConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_formSubmissionFileId_key" ON "Invoice"("formSubmissionFileId");

