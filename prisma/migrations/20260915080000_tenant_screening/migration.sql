-- CreateEnum
CREATE TYPE "ScreeningDecision" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "tenant_screenings" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "requestedDate" TIMESTAMP(3),
    "completedDate" TIMESTAMP(3),
    "reportUrl" TEXT,
    "summary" TEXT,
    "decision" "ScreeningDecision" NOT NULL DEFAULT 'PENDING',
    "decisionNotes" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_screenings_leadId_key" ON "tenant_screenings"("leadId");

-- AddForeignKey
ALTER TABLE "tenant_screenings" ADD CONSTRAINT "tenant_screenings_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_screenings" ADD CONSTRAINT "tenant_screenings_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
