"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { checkRentEscalation } from "@/lib/rules";

// Tenancy type, Base rent and "Utilities included in rent" were dropped
// from the Unit form (owner's call — none of the three were useful day to
// day; the Dropbox Sign Suite/Townhome template choice that
// utilitiesIncludedInRent used to drive is now derived from the unit's
// own address instead, see sendLeaseForSignature in actions/leases.ts).
// Deliberately not parsed here any more, so neither create nor update
// below touches them — an update leaves whatever's already on file
// untouched, and a brand-new unit just gets the schema's own defaults
// (tenancyType/utilitiesIncludedInRent) or a sensible one computed here
// (baseRent, which has no column default).
function parseUnitForm(formData: FormData) {
  return {
    projectEntityId: formData.get("projectEntityId") as string,
    unitNumber: (formData.get("unitNumber") as string).trim(),
    bedrooms: Number(formData.get("bedrooms")),
    sqft: formData.get("sqft") ? Number(formData.get("sqft")) : null,
    cmhcDesignation: formData.get("cmhcDesignation") as
      | "MARKET"
      | "AFFORDABLE",
    currentRent: Number(formData.get("currentRent")),
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

  // baseRent has no column default (unlike tenancyType/
  // utilitiesIncludedInRent, which fall back to the schema's own
  // defaults by being left out of `data` entirely) — defaulting it to
  // the rent actually being set now is the closest sensible value with
  // no form field left to type one in directly.
  const unit = await prisma.unit.create({
    data: { ...data, baseRent: data.currentRent },
  });

  revalidatePath(`/projects/${data.projectEntityId}`);
  redirect(`/units/${unit.id}`);
}

export async function updateUnit(id: string, formData: FormData) {
  const data = parseUnitForm(formData);
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) redirect("/projects");

  // Rent is an owner-only decision once a unit is live — a rent change
  // itself now happens outside the app (Alina/Cindy decide and act on it
  // directly), and the new figure lands here automatically the next time
  // syncUnitCurrentRent() runs off a new lease (see actions/leases.ts);
  // editing it directly from this form is still owner-only. Checked here
  // too, not just hidden in the form, same "enforced, not just hidden"
  // pattern as requireOwnerPage/Action elsewhere.
  if (Number(existing!.currentRent) !== data.currentRent) {
    const session = await auth();
    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "owner") {
      redirect(
        `/units/${id}?error=${encodeURIComponent("Only an owner can change current rent directly — submit a rent recommendation instead.")}`,
      );
    }
  }

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

  revalidatePath(`/units/${id}`);
  revalidatePath(`/projects/${data.projectEntityId}`);
  redirect(`/units/${id}`);
}
