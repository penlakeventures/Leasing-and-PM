-- Dedicated Dropbox Sign template for the "Send renewal for signature"
-- one-click flow on the Renewals tab, separate from the full lease
-- templates (a renewal is its own shorter document, not a full re-signed
-- lease).
-- AlterTable
ALTER TABLE "signing_settings" ADD COLUMN     "leaseRenewalTemplateId" TEXT;
