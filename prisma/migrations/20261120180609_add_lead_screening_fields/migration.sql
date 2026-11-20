-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "employmentNotes" TEXT,
ADD COLUMN     "moveInFlexible" BOOLEAN,
ADD COLUMN     "occupantCount" INTEGER,
ADD COLUMN     "pets" TEXT,
ADD COLUMN     "reasonForMoving" TEXT;
