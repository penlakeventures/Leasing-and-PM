-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "requestedMoveInDate" TIMESTAMP(3),
ADD COLUMN     "message" TEXT,
ADD COLUMN     "externalRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "leads_externalRef_key" ON "leads"("externalRef");
