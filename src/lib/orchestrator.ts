// The "orchestrator agent" from the original system design: routes an
// inbound text to the right specialist and has it draft something for a
// human to review, so nothing just sits there until someone happens to
// open the right page. Called once, right after an inbound text is
// logged (see the Twilio webhook route) — never on its own schedule,
// and it only ever writes a draft, never sends anything.
import { prisma } from "@/lib/prisma";
import { pickActiveLease } from "@/lib/rules";
import {
  classifyTenantMessage,
  draftMaintenanceTicket,
  draftTenantReply,
  draftSmsReply,
} from "@/lib/claude";

export function buildTenantContext(
  tenant: { name: string },
  activeLease: {
    rentAmount: unknown;
    startDate: Date;
    endDate: Date | null;
    periodic: boolean;
    unit: { unitNumber: string; bedrooms: number; projectEntity: { internalName: string; address: string } };
  } | null,
): string {
  const lines = [`Tenant: ${tenant.name}.`];
  if (activeLease) {
    lines.push(
      `Unit: ${activeLease.unit.projectEntity.internalName} — Unit ${activeLease.unit.unitNumber}, ${activeLease.unit.bedrooms} bedroom(s), address ${activeLease.unit.projectEntity.address}.`,
    );
    lines.push(`Rent: $${activeLease.rentAmount}/month, due on the 1st of each month.`);
    lines.push(
      activeLease.periodic
        ? `Lease type: month-to-month (periodic), started ${activeLease.startDate.toLocaleDateString()}.`
        : `Lease type: fixed-term, ${activeLease.startDate.toLocaleDateString()} to ${activeLease.endDate?.toLocaleDateString() ?? "(no end date on file)"}.`,
    );
  } else {
    lines.push("No active lease/unit on file for this tenant.");
  }
  return lines.join("\n");
}

export function buildLeadContext(lead: {
  contactName: string | null;
  source: string;
  status: string;
  requestedMoveInDate: Date | null;
  message: string | null;
  unit:
    | {
        unitNumber: string;
        bedrooms: number;
        currentRent: unknown;
        projectEntity: { internalName: string; address: string };
      }
    | null;
}): string {
  const lines = [
    `Prospective tenant: ${lead.contactName ?? "name unknown"}.`,
    `Inquiry source: ${lead.source}.`,
    lead.unit
      ? `Interested in: ${lead.unit.projectEntity.internalName} — Unit ${lead.unit.unitNumber}, ${lead.unit.bedrooms} bedroom(s), current rent $${lead.unit.currentRent}, address ${lead.unit.projectEntity.address}.`
      : "Not tied to a specific unit — general interest inquiry.",
  ];
  if (lead.requestedMoveInDate) {
    lines.push(`Requested move-in date on file: ${lead.requestedMoveInDate.toLocaleDateString()}.`);
  }
  if (lead.message) lines.push(`Notes/original inquiry: ${lead.message}`);
  lines.push(`Current status in our system: ${lead.status}.`);
  return lines.join("\n");
}

async function triageTenantMessage(tenantId: string, latestBody: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      leases: { include: { lease: { include: { unit: { include: { projectEntity: true } } } } } },
      communications: { where: { channel: "TEXT" }, orderBy: { timestamp: "asc" } },
    },
  });
  if (!tenant) return;

  const activeLease = pickActiveLease(tenant.leases.map((lt) => lt.lease));
  const transcript = tenant.communications.map((c) => ({ direction: c.direction, text: c.summary }));
  const category = await classifyTenantMessage(latestBody);

  if (category === "MAINTENANCE" && activeLease) {
    const draft = await draftMaintenanceTicket({
      tenantContext: `Tenant: ${tenant.name}. Unit: ${activeLease.unit.projectEntity.internalName} — Unit ${activeLease.unit.unitNumber}.`,
      transcript,
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { draftTicketDescription: draft.description, draftTicketPriority: draft.priority },
    });
    return;
  }

  // Falls through to a Q&A draft even for a maintenance-classified text
  // when there's no active lease/unit on file — a ticket needs a unit, a
  // reply doesn't, so staff still gets something useful to review instead
  // of nothing.
  const draftReply = await draftTenantReply({
    tenantContext: buildTenantContext(tenant, activeLease),
    transcript,
  });
  await prisma.tenant.update({ where: { id: tenantId }, data: { draftReply } });
}

async function triageLeadMessage(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      unit: { include: { projectEntity: true } },
      communications: { where: { channel: "TEXT" }, orderBy: { timestamp: "asc" } },
    },
  });
  if (!lead) return;

  const draftReply = await draftSmsReply({
    leadContext: buildLeadContext(lead),
    transcript: lead.communications.map((c) => ({ direction: c.direction, text: c.summary })),
  });
  await prisma.lead.update({ where: { id: leadId }, data: { draftReply } });
}

// Never throws — a classification or drafting failure here must never
// break message logging, which is the one thing that always has to
// succeed. Worst case, staff draft manually from the tenant/lead page,
// same as before this existed.
export async function triageInboundMessage(
  contact: { tenantId: string } | { leadId: string } | { vendorId: string },
  latestBody: string,
): Promise<void> {
  try {
    if ("tenantId" in contact) {
      await triageTenantMessage(contact.tenantId, latestBody);
    } else if ("leadId" in contact) {
      await triageLeadMessage(contact.leadId);
    }
    // Vendors: no AI-drafted reply — a vendor text is usually a status
    // update ("done", "will be there tomorrow"), not something worth
    // auto-drafting a reply to. Just left flagged in the Inbox.
  } catch (e) {
    console.error("[triageInboundMessage] failed:", e);
  }
}
