-- Self-referencing link: a lease created via "Create renewal" points back
-- at the lease it renews, so the same tenant's Dropbox folder can be
-- carried across instead of archived, and so an ending lease can tell it
-- already has a renewal on file.
ALTER TABLE "leases" ADD COLUMN "renewedFromLeaseId" TEXT;

CREATE UNIQUE INDEX "leases_renewedFromLeaseId_key" ON "leases"("renewedFromLeaseId");

ALTER TABLE "leases" ADD CONSTRAINT "leases_renewedFromLeaseId_fkey"
  FOREIGN KEY ("renewedFromLeaseId") REFERENCES "leases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
