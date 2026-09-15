"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createTourEvent,
  cancelTourEvent,
  localWallClockToUtc,
  TOUR_TIMEZONE,
} from "@/lib/google-calendar";

export async function disconnectCalendar() {
  await prisma.calendarConnection.deleteMany({});
  revalidatePath("/settings/calendar");
  redirect("/settings/calendar");
}

export async function scheduleTour(leadId: string, formData: FormData) {
  const dateTimeLocal = formData.get("tourDateTime") as string;
  const staffId = formData.get("tourStaffId") as string;
  if (!dateTimeLocal || !staffId) {
    redirect(
      `/leads/${leadId}?error=${encodeURIComponent("Pick a date/time and a staff member.")}`,
    );
  }

  const [lead, staff] = await Promise.all([
    prisma.lead.findUnique({
      where: { id: leadId },
      include: { unit: { include: { projectEntity: true } } },
    }),
    prisma.user.findUnique({ where: { id: staffId } }),
  ]);
  if (!lead) redirect("/leads");
  if (!staff) {
    redirect(`/leads/${leadId}?error=${encodeURIComponent("That staff member wasn't found.")}`);
  }

  const startAt = localWallClockToUtc(dateTimeLocal, TOUR_TIMEZONE);

  const unitLabel = lead.unit
    ? `${lead.unit.projectEntity.internalName} — Unit ${lead.unit.unitNumber}`
    : "General interest";
  const summary = `Tour: ${lead.contactName ?? "Prospective tenant"} — ${unitLabel}`;
  const description = [
    lead.contactPhone ? `Phone: ${lead.contactPhone}` : null,
    lead.contactEmail ? `Email: ${lead.contactEmail}` : null,
    lead.message ? `Notes: ${lead.message}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const location = lead.unit?.projectEntity.address ?? null;
  const attendeeEmails = [staff.email, lead.contactEmail].filter(
    (e): e is string => Boolean(e),
  );

  let eventId: string;
  try {
    eventId = await createTourEvent({
      startAt,
      summary,
      description,
      location,
      attendeeEmails,
    });
  } catch (e) {
    // Logged in full for troubleshooting; staff see a shorter version
    // pointing at the likely fix rather than a raw API error dump.
    console.error("[scheduleTour] createTourEvent failed:", e);
    redirect(
      `/leads/${leadId}?error=${encodeURIComponent("Couldn't create the calendar event — try reconnecting Google Calendar in Settings, then try again.")}`,
    );
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { tourAt: startAt, tourStaffId: staffId, tourEventId: eventId! },
  });

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}

export async function cancelTour(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) redirect("/leads");

  if (lead.tourEventId) {
    try {
      await cancelTourEvent(lead.tourEventId);
    } catch (e) {
      console.error("[cancelTour] cancelTourEvent failed:", e);
      redirect(
        `/leads/${leadId}?error=${encodeURIComponent("Couldn't cancel the calendar event — try reconnecting Google Calendar in Settings, then try again.")}`,
      );
    }
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { tourAt: null, tourStaffId: null, tourEventId: null },
  });

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}
