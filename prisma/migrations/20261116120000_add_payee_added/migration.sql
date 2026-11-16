-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Party" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "panNo" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "pageHandle" TEXT,
    "bankAccName" TEXT,
    "bankName" TEXT,
    "bankAccNo" TEXT,
    "ifsc" TEXT,
    "upiId" TEXT,
    "notes" TEXT,
    "payeeAdded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Party" ("address", "bankAccName", "bankAccNo", "bankName", "createdAt", "email", "gstin", "id", "ifsc", "name", "notes", "pageHandle", "panNo", "phone", "type", "updatedAt", "upiId") SELECT "address", "bankAccName", "bankAccNo", "bankName", "createdAt", "email", "gstin", "id", "ifsc", "name", "notes", "pageHandle", "panNo", "phone", "type", "updatedAt", "upiId" FROM "Party";
DROP TABLE "Party";
ALTER TABLE "new_Party" RENAME TO "Party";
CREATE INDEX "Party_type_idx" ON "Party"("type");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
