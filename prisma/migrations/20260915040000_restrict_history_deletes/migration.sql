-- These three foreign keys previously let a delete silently cascade or
-- null out real records the app's own delete actions claim are protected:
--   * deleting a lease with a security deposit on file used to
--     cascade-delete the deposit (real trust money) instead of being
--     blocked, as deleteLease()'s error message already promised.
--   * deleting a tenant used to silently drop them off every past lease
--     they were ever on, instead of being blocked, as deleteTenant()'s
--     error message already promised.
--   * deleting a vendor used to silently null out which vendor worked on
--     every past maintenance ticket, instead of being blocked, as
--     deleteVendor()'s error message already promised.
-- Changing these to RESTRICT makes the database actually enforce what the
-- application code already believed was true. No existing data changes —
-- this only affects future delete attempts.

ALTER TABLE "security_deposits" DROP CONSTRAINT "security_deposits_leaseId_fkey";
ALTER TABLE "security_deposits" ADD CONSTRAINT "security_deposits_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "leases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "lease_tenants" DROP CONSTRAINT "lease_tenants_tenantId_fkey";
ALTER TABLE "lease_tenants" ADD CONSTRAINT "lease_tenants_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "maintenance_tickets" DROP CONSTRAINT "maintenance_tickets_vendorId_fkey";
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
