"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkRentEscalation } from "@/lib/rules";

function parseUnitForm(formData: FormData) {
  return {
    projectEntityId: formData.get("projectEntityId") as string,
    unitType: formData.get("unitType") as "TOWN" | "SUITE" | "BARN",
    bedrooms: Number(formData.get("bedrooms")),
    sqft: formData.get("sqft") ? Number(formData.get("sqft")) : null,
    cmhcDesignation: formData.get("cmhcDesignation") as
      | "MARKET"
      | "AFFORDABLE",
    baseRent: Number(formData.get("baseRent")),
    currentRent: Number(formData.get("currentRent")),
    tenancyType: formData.get("tenancyType") as "EXTERNAL" | "INTERNAL",
  };
}

async function currentCpiRate(): Promise<number | null> {
  const rate = await prisma.cpiRate.findUnique({
    where: { year: new Date().getFullYear() },
  });
  return rate ? Number(rate.ratePercent) : null;
}

export async function createUnit(formData: FormData) {
  const data = parseUnitForm(formData);

  await prisma.unit.create({ data });

  revalidatePath("/units");
  revalidatePath(`/projects/${data.projectEntityId}`);
  redirect("/units");
}

export async function updateUnit(id: string, formData: FormData) {
  const data = parseUnitForm(formData);
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) redirect("/units");

  // Rent changes on an affordable unit are capped at the current year's CPI.
  if (
    data.cmhcDesignation === "AFFORDABLE" &&
    Number(existing!.currentRent) !== data.currentRent
  ) {
    const cpiRatePercent = await currentCpiRate();
    const check = checkRentEscalation({
      cmhcDesignation: "AFFORDABLE",
      currentRent: Number(existing!.currentRent),
      proposedRent: data.currentRent,
      cpiRatePercent,
    });
    if (!check.allowed) {
      redirect(`/units/${id}?error=${encodeURIComponent(check.reason!)}`);
    }
  }

  await prisma.unit.update({ where: { id }, data });

  revalidatePath("/units");
  revalidatePath(`/units/${id}`);
  revalidatePath(`/projects/${data.projectEntityId}`);
  redirect("/units");
}

export async function deleteUnit(id: string) {
  try {
    await prisma.unit.delete({ where: { id } });
  } catch {
    redirect(
      `/units/${id}?error=${encodeURIComponent("Can't delete a unit that still has leases, leads, or tickets attached.")}`,
    );
  }
  revalidatePath("/units");
  redirect("/units");
}
