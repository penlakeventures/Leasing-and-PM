"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Snapshots current affordable-unit rents for the project — the annual
// CMHC reporting requirement — rather than requiring hand-typed JSON.
export async function createComplianceRecord(formData: FormData) {
  const projectEntityId = formData.get("projectEntityId") as string;
  const year = Number(formData.get("year"));
  const submittedDateRaw = formData.get("submittedDate") as string;
  const reportingDeadlineRaw = formData.get("reportingDeadline") as string;

  const affordableUnits = await prisma.unit.findMany({
    where: { projectEntityId, cmhcDesignation: "AFFORDABLE" },
    select: { id: true, unitNumber: true, bedrooms: true, currentRent: true },
  });

  // Nothing to report for a project with no affordable units — the New
  // Compliance Record form already only offers projects that have some,
  // but guard here too against hitting this directly.
  if (affordableUnits.length === 0) {
    redirect(
      `/compliance/new?error=${encodeURIComponent("That project has no affordable units — nothing to report.")}`,
    );
  }

  const snapshot = affordableUnits.map((u) => ({
    unitId: u.id,
    unitNumber: u.unitNumber,
    bedrooms: u.bedrooms,
    rent: Number(u.currentRent),
  }));

  try {
    await prisma.complianceRecord.create({
      data: {
        projectEntityId,
        year,
        affordableUnitRentsReported: snapshot,
        submittedDate: submittedDateRaw ? new Date(submittedDateRaw) : null,
        reportingDeadline: reportingDeadlineRaw ? new Date(reportingDeadlineRaw) : null,
      },
    });
  } catch {
    redirect(
      `/compliance/new?error=${encodeURIComponent("A compliance record for that project and year already exists.")}`,
    );
  }

  revalidatePath("/compliance");
  redirect("/compliance");
}

export async function markSubmitted(id: string, formData: FormData) {
  const submittedDateRaw = formData.get("submittedDate") as string;
  await prisma.complianceRecord.update({
    where: { id },
    data: { submittedDate: submittedDateRaw ? new Date(submittedDateRaw) : new Date() },
  });
  revalidatePath("/compliance");
  redirect("/compliance");
}

// The deadline is learned from the lender, often well after the record
// itself was created (or needs correcting once a lender revises it) — so
// this is editable independently of markSubmitted, any time.
export async function setReportingDeadline(id: string, formData: FormData) {
  const reportingDeadlineRaw = formData.get("reportingDeadline") as string;
  await prisma.complianceRecord.update({
    where: { id },
    data: { reportingDeadline: reportingDeadlineRaw ? new Date(reportingDeadlineRaw) : null },
  });
  revalidatePath("/compliance");
  redirect("/compliance");
}

export async function deleteComplianceRecord(id: string) {
  await prisma.complianceRecord.delete({ where: { id } });
  revalidatePath("/compliance");
  redirect("/compliance");
}
