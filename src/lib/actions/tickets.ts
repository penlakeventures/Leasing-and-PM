"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sendSms } from "@/lib/twilio";

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
  redirect("/tickets");
}

const PRIORITY_LABEL: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "URGENT",
};

// Texts the ticket's assigned vendor with what they need to act on it —
// unit address and tenant contact so they can arrange access directly,
// the same info a dispatcher would give over the phone. A deliberate,
// staff-triggered action (not automatic on assignment or every edit), so
// a vendor is never texted about a ticket that's still being sorted out.
export async function notifyVendor(ticketId: string) {
  const ticket = await prisma.maintenanceTicket.findUnique({
    where: { id: ticketId },
    include: {
      unit: { include: { projectEntity: true } },
      tenant: true,
      vendor: true,
    },
  });
  if (!ticket) redirect("/tickets");
  if (!ticket.vendor) {
    redirect(`/tickets/${ticketId}?error=${encodeURIComponent("Assign a vendor before notifying them.")}`);
  }
  if (!ticket.vendor.contactPhone) {
    redirect(
      `/tickets/${ticketId}?error=${encodeURIComponent(`${ticket.vendor.name} has no phone number on file.`)}`,
    );
  }

  const session = await auth();
  const lines = [
    `Maintenance request — ${ticket.unit.projectEntity.internalName}, Unit ${ticket.unit.unitNumber}, ${ticket.unit.projectEntity.address}`,
    `Priority: ${PRIORITY_LABEL[ticket.priority] ?? ticket.priority}`,
    ticket.description,
  ];
  if (ticket.tenant) {
    lines.push(
      `Tenant: ${ticket.tenant.name}${ticket.tenant.phone ? `, ${ticket.tenant.phone}` : ""}`,
    );
  }
  const body = lines.join("\n");

  try {
    const sid = await sendSms({ to: ticket.vendor.contactPhone, body });
    await prisma.communicationLog.create({
      data: {
        vendorId: ticket.vendor.id,
        channel: "TEXT",
        direction: "OUTBOUND",
        summary: body,
        handledById: session?.user?.id ?? null,
        externalRef: `twilio:${sid}`,
      },
    });
    await prisma.maintenanceTicket.update({
      where: { id: ticketId },
      data: { vendorNotifiedAt: new Date() },
    });
  } catch (e) {
    console.error("[notifyVendor] sendSms failed:", e);
    redirect(
      `/tickets/${ticketId}?error=${encodeURIComponent("Couldn't text the vendor — check the Texting settings and try again.")}`,
    );
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath(`/vendors/${ticket.vendor.id}`);
  revalidatePath("/communications");
  redirect(`/tickets/${ticketId}`);
}

export async function deleteTicket(id: string) {
  await prisma.maintenanceTicket.delete({ where: { id } });
  revalidatePath("/tickets");
  redirect("/tickets");
}
