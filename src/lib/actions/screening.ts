"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// SingleKey (or similar) is a portal this app has no API access to — this
// records the outcome staff already looked up there, plus the human
// decision. Never derives approve/decline from the report itself.
export async function upsertScreening(leadId: string, formData: FormData) {
  const session = await auth();

  const requestedDateRaw = formData.get("requestedDate") as string;
  const completedDateRaw = formData.get("completedDate") as string;
  const reportUrl = (formData.get("reportUrl") as string)?.trim() || null;
  const summary = (formData.get("summary") as string)?.trim() || null;
  const decision = formData.get("decision") as
    | "PENDING"
    | "APPROVED"
    | "DECLINED";
  const decisionNotes =
    (formData.get("decisionNotes") as string)?.trim() || null;

  const existing = await prisma.tenantScreening.findUnique({
    where: { leadId },
  });

  // Stamp who decided and when only on an actual change of decision —
  // resetting to Pending clears the stamp (nothing is decided anymore),
  // and re-saving the same decision (e.g. just editing a note) doesn't
  // bump the timestamp or reassign it to whoever happens to be saving
  // today.
  let decidedById = existing?.decidedById ?? null;
  let decidedAt = existing?.decidedAt ?? null;
  if (decision === "PENDING") {
    decidedById = null;
    decidedAt = null;
  } else if (existing?.decision !== decision) {
    decidedById = session?.user?.id ?? null;
    decidedAt = new Date();
  }

  const data = {
    requestedDate: requestedDateRaw ? new Date(requestedDateRaw) : null,
    completedDate: completedDateRaw ? new Date(completedDateRaw) : null,
    reportUrl,
    summary,
    decision,
    decisionNotes,
    decidedById,
    decidedAt,
  };

  await prisma.tenantScreening.upsert({
    where: { leadId },
    create: { leadId, ...data },
    update: data,
  });

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}

export async function deleteScreening(leadId: string) {
  await prisma.tenantScreening.delete({ where: { leadId } });
  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}
