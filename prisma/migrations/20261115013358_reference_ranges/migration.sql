-- AlterTable
ALTER TABLE "LabPanel" ADD COLUMN "cyclePhase" TEXT;
ALTER TABLE "LabPanel" ADD COLUMN "menopause" BOOLEAN;
ALTER TABLE "LabPanel" ADD COLUMN "pregnant" BOOLEAN;
ALTER TABLE "LabPanel" ADD COLUMN "specimen" TEXT;
ALTER TABLE "LabPanel" ADD COLUMN "trimester" INTEGER;

-- AlterTable
ALTER TABLE "LabResult" ADD COLUMN "appliedNote" TEXT;
ALTER TABLE "LabResult" ADD COLUMN "testCode" TEXT;

-- CreateTable
CREATE TABLE "TestDefinition" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "defaultUnit" TEXT,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "ReferenceRange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testCode" TEXT NOT NULL,
    "specimen" TEXT NOT NULL DEFAULT 'any',
    "sex" TEXT NOT NULL DEFAULT 'any',
    "ageMinDays" INTEGER NOT NULL DEFAULT 0,
    "ageMaxDays" INTEGER NOT NULL DEFAULT 36500,
    "state" TEXT NOT NULL DEFAULT 'none',
    "min" REAL,
    "max" REAL,
    "unit" TEXT NOT NULL,
    "panicLow" REAL,
    "panicHigh" REAL,
    "note" TEXT
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "testCode" TEXT NOT NULL,
    "fromUnit" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "factor" REAL NOT NULL,
    "offset" REAL NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE INDEX "ReferenceRange_testCode_sex_state_idx" ON "ReferenceRange"("testCode", "sex", "state");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_testCode_fromUnit_toUnit_key" ON "UnitConversion"("testCode", "fromUnit", "toUnit");
