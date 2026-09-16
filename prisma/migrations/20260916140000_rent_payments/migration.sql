-- CreateTable
CREATE TABLE "rent_payments" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "period" TIMESTAMP(3) NOT NULL,
    "amountDue" DECIMAL(10,2) NOT NULL,
    "paidDate" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rent_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rent_payments_leaseId_idx" ON "rent_payments"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "rent_payments_leaseId_period_key" ON "rent_payments"("leaseId", "period");

-- AddForeignKey
ALTER TABLE "rent_payments" ADD CONSTRAINT "rent_payments_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
