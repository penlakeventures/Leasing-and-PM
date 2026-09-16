-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "draftTicketDescription" TEXT,
ADD COLUMN "draftTicketPriority" "TicketPriority";

-- AlterTable
ALTER TABLE "maintenance_tickets" ADD COLUMN "vendorNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "communication_logs" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "communication_logs_vendorId_idx" ON "communication_logs"("vendorId");

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;
