"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pickActiveLease } from "@/lib/rules";
import { draftMaintenanceTicket } from "@/lib/claude";

function parseTenantForm(formData: FormData) {
  return {
    name: (formData.get("name") as string).trim(),
    phone: (formData.get("phone") as string)?.trim() || null,
    email: (formData.get("email") as string)?.trim() || null,
    emergencyContactName:
      (formData.get("emergencyContactName") as string)?.trim() || null,
    emergencyContactPhone:
      (formData.get("emergencyContactPhone") as string)?.trim() || null,
  };
}

export async function createTenant(formData: FormData) {
  const data = parseTenantForm(formData);
  await prisma.tenant.create({ data });
  revalidatePath("/tenants");
  redirect("/tenants");
}

export async function updateTenant(id: string, formData: FormData) {
  const data = parseTenantForm(formData);
  await prisma.tenant.update({ where: { id }, data });
  revalidatePath("/tenants");
  revalidatePath(`/tenants/${id}`);
  redirect("/tenants");
}

// Generates a suggested maintenance ticket and saves it to the tenant —
// never creates a real ticket. Only ever runs when a staff member clicks
// the button; nothing triggers it automatically on an inbound text.
export async function generateTicketDraft(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      leases: { include: { lease: { include: { unit: { include: { projectEntity: true } } } } } },
      communications: { where: { channel: "TEXT" }, orderBy: { timestamp: "asc" } },
    },
  });
  if (!tenant) redirect("/tenants");

  const activeLease = pickActiveLease(tenant.leases.map((lt) => lt.lease));
  if (!activeLease) {
    redirect(
      `/tenants/${tenantId}?error=${encodeURIComponent("This tenant has no active lease/unit on file — a ticket needs a unit.")}`,
    );
  }

  try {
    const tenantContext = `Tenant: ${tenant.name}. Unit: ${activeLease.unit.projectEntity.internalName} — Unit ${activeLease.unit.unitNumber}.`;
    const draft = await draftMaintenanceTicket({
      tenantContext,
      transcript: tenant.communications.map((c) => ({ direction: c.direction, text: c.summary })),
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { draftTicketDescription: draft.description, draftTicketPriority: draft.priority },
    });
  } catch (e) {
    console.error("[generateTicketDraft] draftMaintenanceTicket failed:", e);
    redirect(
      `/tenants/${tenantId}?error=${encodeURIComponent("Couldn't generate a ticket draft — check the Anthropic API key and try again.")}`,
    );
  }

  revalidatePath(`/tenants/${tenantId}`);
  redirect(`/tenants/${tenantId}`);
}

// Actually creates the ticket from the (possibly edited) draft — the
// human-review step. Unit comes from the tenant's own active lease, not
// from the form, so it can't drift from who this ticket is really for.
export async function createTicketFromDraft(tenantId: string, formData: FormData) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: { leases: { include: { lease: true } } },
  });
  if (!tenant) redirect("/tenants");

  const activeLease = pickActiveLease(tenant.leases.map((lt) => lt.lease));
  if (!activeLease) redirect(`/tenants/${tenantId}`);

  const description = (formData.get("description") as string)?.trim();
  const priority = formData.get("priority") as "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  if (!description) {
    redirect(`/tenants/${tenantId}?error=${encodeURIComponent("Description can't be empty.")}`);
  }

  const ticket = await prisma.maintenanceTicket.create({
    data: { unitId: activeLease.unitId, tenantId, description, priority },
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { draftTicketDescription: null, draftTicketPriority: null },
  });

  revalidatePath(`/tenants/${tenantId}`);
  revalidatePath("/tickets");
  redirect(`/tickets/${ticket.id}`);
}

export async function deleteTenant(id: string) {
  try {
    await prisma.tenant.delete({ where: { id } });
  } catch {
    redirect(
      `/tenants/${id}?error=${encodeURIComponent("Can't delete a tenant with lease or ticket history — remove those first.")}`,
    );
  }
  revalidatePath("/tenants");
  redirect("/tenants");
}
