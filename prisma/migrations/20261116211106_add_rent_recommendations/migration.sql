-- CreateEnum
CREATE TYPE "RentRecommendationDecision" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "rent_recommendations" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "currentRent" DECIMAL(10,2) NOT NULL,
    "proposedRent" DECIMAL(10,2) NOT NULL,
    "reasoning" TEXT NOT NULL,
    "decision" "RentRecommendationDecision" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "proposedById" TEXT NOT NULL,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rent_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rent_recommendations_unitId_idx" ON "rent_recommendations"("unitId");

-- AddForeignKey
ALTER TABLE "rent_recommendations" ADD CONSTRAINT "rent_recommendations_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_recommendations" ADD CONSTRAINT "rent_recommendations_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rent_recommendations" ADD CONSTRAINT "rent_recommendations_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
