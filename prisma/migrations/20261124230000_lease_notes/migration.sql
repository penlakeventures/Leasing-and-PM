-- Free-text staff notes per lease, for the new filterable/sortable
-- Leases grid modeled on Alina's lease-expiry spreadsheet ("Leasing
-- notes"/"Other" columns, combined here into one field).
-- AlterTable
ALTER TABLE "leases" ADD COLUMN     "notes" TEXT;
