-- Alina and Cindy decided the app shouldn't act as a CRM: all prospective-
-- tenant interaction (inquiry, tour, screening) now happens entirely
-- outside the app, and every texting channel (tenants, leads, vendors) is
-- gone in favour of personal replies by phone/text/email handled directly
-- by staff. This drops Leads, Tenant Screening, Google Calendar tour
-- scheduling, and the Communications log in full, plus the texting-only
-- columns left behind on tables that otherwise stay.
--
-- This is a real, permanent data loss of history (35 leads, 84 tenant +
-- 37 lead + 0 vendor communication-log rows as of this migration) — the
-- owner reviewed those counts and confirmed deleting them outright rather
-- than exporting first, since every one had already been handled outside
-- the app.

-- DropForeignKey
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_handledById_fkey";

-- DropForeignKey
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_leadId_fkey";

-- DropForeignKey
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "communication_logs" DROP CONSTRAINT "communication_logs_vendorId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_tourStaffId_fkey";

-- DropForeignKey
ALTER TABLE "leads" DROP CONSTRAINT "leads_unitId_fkey";

-- DropForeignKey
ALTER TABLE "tenant_screenings" DROP CONSTRAINT "tenant_screenings_decidedById_fkey";

-- DropForeignKey
ALTER TABLE "tenant_screenings" DROP CONSTRAINT "tenant_screenings_leadId_fkey";

-- AlterTable
-- "Notify vendor" (SMS) is gone; the ticket itself (status/priority/
-- vendor assignment/cost) stays exactly as it was.
ALTER TABLE "maintenance_tickets" DROP COLUMN "vendorNotifiedAt";

-- AlterTable
-- The automated daily SMS rent-reminder was already disabled in
-- production (REMINDERS_ENABLED = false) and is being removed outright
-- now that texting is gone; staff send a personal reminder by hand
-- instead, using the overdue status already visible on the Rent page.
ALTER TABLE "rent_payments" DROP COLUMN "reminderSentAt";

-- AlterTable
ALTER TABLE "tenants" DROP COLUMN "attentionClearedAt",
DROP COLUMN "draftReply",
DROP COLUMN "draftTicketDescription",
DROP COLUMN "draftTicketPriority";

-- AlterTable
ALTER TABLE "vendors" DROP COLUMN "attentionClearedAt";

-- DropTable
DROP TABLE "calendar_connections";

-- DropTable
DROP TABLE "communication_logs";

-- DropTable
DROP TABLE "leads";

-- DropTable
DROP TABLE "tenant_screenings";

-- DropEnum
DROP TYPE "CommChannel";

-- DropEnum
DROP TYPE "CommDirection";

-- DropEnum
DROP TYPE "LeadSource";

-- DropEnum
DROP TYPE "LeadStatus";

-- DropEnum
DROP TYPE "ScreeningDecision";
