-- AlterTable
ALTER TABLE "units" ADD COLUMN "utilitiesIncludedInRent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "leases" ADD COLUMN "signatureRequestId" TEXT,
ADD COLUMN "signatureSentAt" TIMESTAMP(3),
ADD COLUMN "additionalTermsText" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leases_signatureRequestId_key" ON "leases"("signatureRequestId");

-- CreateTable
CREATE TABLE "signing_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "landlordSignerName" TEXT,
    "landlordSignerEmail" TEXT,
    "leaseTownhomeTemplateId" TEXT,
    "leaseSuiteTemplateId" TEXT,
    "smokingAddendumTemplateId" TEXT,
    "additionalTermsTemplateId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signing_settings_pkey" PRIMARY KEY ("id")
);
