-- AlterTable
ALTER TABLE "leads" ADD COLUMN "attentionClearedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "attentionClearedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "vendors" ADD COLUMN "attentionClearedAt" TIMESTAMP(3);
