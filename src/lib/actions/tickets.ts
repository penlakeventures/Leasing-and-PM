"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseTicketForm(formData: FormData) {
  const costRaw = formData.get("cost") as string;
  const status = formData.get("status") as
    | "NEW"
    | "ASSIGNED"
    | "IN_PROGRESS"
    | "RESOLVED";
  return {
    unitId: formData.get("unitId") as string,
    tenantId: (formData.get("tenantId") as string) || null,
    description: (formData.get("description") as string).trim(),
    priority: formData.get("priority") as "LOW" | "MEDIUM" | "HIGH" | "URGENT",
    status,
    vendorId: (formData.get("vendorId") as string) || null,
    cost: costRaw ? Number(costRaw) : null,
    resolvedAt: status === "RESOLVED" ? new Date() : null,
  };
}

export async function createTicket(formData: FormData) {
  const data = parseTicketForm(formData);
  await prisma.maintenanceTicket.create({ data });
  revalidatePath("/tickets");
  redirect("/tickets");
}

export async function updateTicket(id: string, formData: FormData) {
  const data = parseTicketForm(formData);
  const existing = await prisma.maintenanceTicket.findUnique({ where: { id } });

  await prisma.maintenanceTicket.update({
    where: { id },
    data: {
      ...data,
      // Don't clobber an already-recorded resolution time if it's re-saved
      // while still resolved.
      resolvedAt:
        data.status === "RESOLVED"
          ? existing?.resolvedAt ?? new Date()
          : null,
    },
  });
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  if (existing?.unitId) revalidatePath(`/units/${existing.unitId}`);
  redirect("/tickets");
}

// One-click "mark complete" for the tickets list and the ticket detail page
// — same effect as switching the Status field to Resolved and saving, but
// without opening the full edit form. Stays on the current page (no
// redirect): the list's own default filter is what makes the ticket flush
// out of view once this revalidates it, same as the Status-dropdown path.
export async function resolveTicket(id: string) {
  const existing = await prisma.maintenanceTicket.findUnique({ where: { id } });
  await prisma.maintenanceTicket.update({
    where: { id },
    data: { status: "RESOLVED", resolvedAt: existing?.resolvedAt ?? new Date() },
  });
  revalidatePath("/tickets");
  revalidatePath(`/tickets/${id}`);
  if (existing?.unitId) revalidatePath(`/units/${existing.unitId}`);
}
