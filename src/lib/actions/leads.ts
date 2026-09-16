"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { draftSmsReply } from "@/lib/claude";

function parseLeadForm(formData: FormData) {
  const unitId = (formData.get("unitId") as string) || null;
  const moveInRaw = formData.get("requestedMoveInDate") as string;
  return {
    source: formData.get("source") as "RENTFASTER" | "FACEBOOK_MARKETPLACE" | "OTHER",
    unitId,
    contactName: (formData.get("contactName") as string)?.trim() || null,
    contactPhone: (formData.get("contactPhone") as string)?.trim() || null,
    contactEmail: (formData.get("contactEmail") as string)?.trim() || null,
    requestedMoveInDate: moveInRaw ? new Date(moveInRaw) : null,
    message: (formData.get("message") as string)?.trim() || null,
    status: formData.get("status") as
      | "NEW"
      | "CONTACTED"
      | "TOURING"
      | "APPLIED"
      | "SCREENED"
      | "LEASED"
      | "LOST",
  };
}

export async function createLead(formData: FormData) {
  const data = parseLeadForm(formData);
  await prisma.lead.create({ data });
  revalidatePath("/leads");
  redirect("/leads");
}

export async function updateLead(id: string, formData: FormData) {
  const data = parseLeadForm(formData);
  await prisma.lead.update({ where: { id }, data });
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect("/leads");
}

function buildLeadContext(lead: {
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

// Generates a suggested reply and saves it to the lead — never sends
// anything. Only ever runs when a staff member clicks the button; nothing
// in this app triggers it automatically.
export async function generateLeadReplyDraft(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      unit: { include: { projectEntity: true } },
      communications: {
        where: { channel: "TEXT" },
        orderBy: { timestamp: "asc" },
      },
    },
  });
  if (!lead) redirect("/leads");

  try {
    const draftReply = await draftSmsReply({
      leadContext: buildLeadContext(lead),
      transcript: lead.communications.map((c) => ({
        direction: c.direction,
        text: c.summary,
      })),
    });
    await prisma.lead.update({ where: { id: leadId }, data: { draftReply } });
  } catch (e) {
    console.error("[generateLeadReplyDraft] draftSmsReply failed:", e);
    redirect(
      `/leads/${leadId}?error=${encodeURIComponent("Couldn't generate a draft reply — check the Anthropic API key and try again.")}`,
    );
  }

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}

export async function deleteLead(id: string) {
  try {
    await prisma.lead.delete({ where: { id } });
  } catch {
    redirect(
      `/leads/${id}?error=${encodeURIComponent("Can't delete a lead with a screening record on file — resolve that first.")}`,
    );
  }
  revalidatePath("/leads");
  redirect("/leads");
}
