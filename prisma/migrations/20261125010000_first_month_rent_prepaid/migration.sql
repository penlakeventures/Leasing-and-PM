-- Tracks first month's rent collected up front, same shape as the
-- existing lastMonthRentPrepaid — both now shown on the Trust ledger
-- page alongside the security deposit itself.
-- AlterTable
ALTER TABLE "leases" ADD COLUMN     "firstMonthRentPrepaid" DECIMAL(10,2);
