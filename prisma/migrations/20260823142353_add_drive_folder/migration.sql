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
    "driveFolderId" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_SheetSyncConfig" ("commissionSheetName", "enabled", "id", "purchaseSheetName", "salesSheetName", "serviceAccountJson", "spreadsheetId") SELECT "commissionSheetName", "enabled", "id", "purchaseSheetName", "salesSheetName", "serviceAccountJson", "spreadsheetId" FROM "SheetSyncConfig";
DROP TABLE "SheetSyncConfig";
ALTER TABLE "new_SheetSyncConfig" RENAME TO "SheetSyncConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
