-- AlterTable
ALTER TABLE "leases" ADD COLUMN     "lastRentIncreaseDate" TIMESTAMP(3),
ADD COLUMN     "rentIncreaseNoticeGivenDate" TIMESTAMP(3);
