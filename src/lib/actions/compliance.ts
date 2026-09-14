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

  const affordableUnits = await prisma.unit.findMany({
    where: { projectEntityId, cmhcDesignation: "AFFORDABLE" },
    select: { id: true, unitNumber: true, bedrooms: true, currentRent: true },
  });

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

export async function deleteComplianceRecord(id: string) {
  await prisma.complianceRecord.delete({ where: { id } });
  revalidatePath("/compliance");
  redirect("/compliance");
}
