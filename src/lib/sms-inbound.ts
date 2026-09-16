import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/phone";

// Finds who an inbound text is from. A current tenant takes priority over
// a lead sharing the same number (e.g. someone who inquired as a lead and
// later signed a lease) — once they're a tenant, that's the more useful
// record to attach ongoing messages to. Small dataset (tens to low
// hundreds of rows with a phone on file) — a full scan with in-JS
// normalization is simpler and plenty fast, versus getting every possible
// stored phone format into one comparable column first.
export async function findContactByPhone(
  from: string,
): Promise<{ tenantId: string } | { leadId: string } | null> {
  const target = normalizePhone(from);

  const tenants = await prisma.tenant.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
  });
  const tenant = tenants.find((t) => t.phone && normalizePhone(t.phone) === target);
  if (tenant) return { tenantId: tenant.id };

  const leads = await prisma.lead.findMany({
    where: { contactPhone: { not: null } },
    select: { id: true, contactPhone: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const lead = leads.find((l) => l.contactPhone && normalizePhone(l.contactPhone) === target);
  if (lead) return { leadId: lead.id };

  return null;
}

// No tenant or lead on file for this number — finds or creates an
// externalRef-keyed Lead the same way the Messenger webhook does, so a
// second text from someone new appends to the same lead's conversation
// instead of creating a new one each time.
export async function findOrCreateLeadForUnknownNumber(
  from: string,
  firstMessage: string,
): Promise<string> {
  const externalRef = `sms:${normalizePhone(from)}`;
  const existing = await prisma.lead.findUnique({ where: { externalRef } });
  if (existing) return existing.id;

  const lead = await prisma.lead.create({
    data: {
      source: "OTHER",
      contactPhone: from,
      message: firstMessage,
      externalRef,
    },
  });
  return lead.id;
}
