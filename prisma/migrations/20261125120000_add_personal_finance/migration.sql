-- CreateTable
CREATE TABLE "PersonalCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bucket" TEXT NOT NULL DEFAULT 'WANTS',
    "monthlyBudget" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "PersonalTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "merchant" TEXT NOT NULL DEFAULT '',
    "amount" DECIMAL NOT NULL,
    "direction" TEXT NOT NULL,
    "categoryId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "importHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PersonalTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalMerchantRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pattern" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PersonalMerchantRule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "PersonalCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PersonalPlan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "monthlySalary" DECIMAL NOT NULL DEFAULT 0,
    "needsPct" INTEGER NOT NULL DEFAULT 50,
    "wantsPct" INTEGER NOT NULL DEFAULT 30,
    "savingsPct" INTEGER NOT NULL DEFAULT 20
);

-- CreateTable
CREATE TABLE "PersonalMonthIncome" (
    "month" TEXT NOT NULL PRIMARY KEY,
    "salary" DECIMAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalCategory_name_key" ON "PersonalCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalTransaction_importHash_key" ON "PersonalTransaction"("importHash");

-- CreateIndex
CREATE INDEX "PersonalTransaction_date_idx" ON "PersonalTransaction"("date");

-- CreateIndex
CREATE INDEX "PersonalTransaction_categoryId_idx" ON "PersonalTransaction"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalMerchantRule_pattern_key" ON "PersonalMerchantRule"("pattern");

