-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "tourAt" TIMESTAMP(3),
ADD COLUMN     "tourStaffId" TEXT,
ADD COLUMN     "tourEventId" TEXT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tourStaffId_fkey" FOREIGN KEY ("tourStaffId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "calendar_connections" (
    "id" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "calendar_connections_googleEmail_key" ON "calendar_connections"("googleEmail");
