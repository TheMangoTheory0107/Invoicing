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
    "termsAndConditions" TEXT NOT NULL DEFAULT '',
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "storagePath" TEXT NOT NULL DEFAULT './storage/invoices',
    "brandColor" TEXT NOT NULL DEFAULT '#134F5C',
    "logoPath" TEXT
);
INSERT INTO "new_Settings" ("addressLine1", "addressLine2", "addressLine3", "bankAccName", "bankAccNo", "bankName", "companyName", "gstin", "id", "ifsc", "pan", "paymentTermsDays", "sacCode", "storagePath", "termsAndConditions", "upiId") SELECT "addressLine1", "addressLine2", "addressLine3", "bankAccName", "bankAccNo", "bankName", "companyName", "gstin", "id", "ifsc", "pan", "paymentTermsDays", "sacCode", "storagePath", "termsAndConditions", "upiId" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
