-- AlterEnum
ALTER TYPE "CommChannel" ADD VALUE 'MESSENGER';

-- AlterTable
ALTER TABLE "communication_logs" ADD COLUMN     "externalRef" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "communication_logs_externalRef_key" ON "communication_logs"("externalRef");
