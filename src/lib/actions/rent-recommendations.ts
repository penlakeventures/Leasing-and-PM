"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireOwnerAction } from "@/lib/require-owner";
import { checkRentEscalation } from "@/lib/rules";

// The "Yellow" decision level from the leasing training manual: staff
// researches comparables and recommends a rent, but it can't take effect
// until an owner approves it. See updateUnit() in lib/actions/units.ts for
// the matching restriction — staff can no longer edit currentRent directly,
// only through this proposal/approval path.
export async function createRentRecommendation(
  unitId: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const unit = await prisma.unit.findUnique({ where: { id: unitId } });
  if (!unit) redirect("/projects");

  const proposedRent = Number(formData.get("proposedRent"));
  const reasoning = (formData.get("reasoning") as string)?.trim();

  if (!proposedRent || proposedRent <= 0) {
    redirect(
      `/units/${unitId}?error=${encodeURIComponent("Enter a valid proposed rent.")}`,
    );
  }
  if (!reasoning) {
    redirect(
      `/units/${unitId}?error=${encodeURIComponent("Add the evidence behind this recommendation — comparables, how quickly they leased, etc.")}`,
    );
  }

  await prisma.rentRecommendation.create({
    data: {
      unitId,
      currentRent: unit!.currentRent,
      proposedRent,
      reasoning,
      proposedById: session.user.id,
    },
  });

  revalidatePath(`/units/${unitId}`);
  redirect(`/units/${unitId}`);
}

export async function decideRentRecommendation(
  id: string,
  formData: FormData,
) {
  const session = await requireOwnerAction();

  const decision = formData.get("decision") as string;
  const decisionNote = (formData.get("decisionNote") as string)?.trim() || null;
  if (decision !== "APPROVED" && decision !== "DECLINED") {
    throw new Error("Invalid decision.");
  }

  const rec = await prisma.rentRecommendation.findUnique({
    where: { id },
    include: { unit: true },
  });
  if (!rec || rec.decision !== "PENDING") redirect("/projects");

  if (decision === "APPROVED") {
    // Same affordable-unit CPI cap applied to a direct edit in
    // updateUnit() — approving a recommendation is still a rent change
    // and shouldn't be able to bypass it.
    if (rec.unit.cmhcDesignation === "AFFORDABLE") {
      const cpiRate = await prisma.cpiRate.findUnique({
        where: { year: new Date().getFullYear() },
      });
      const check = checkRentEscalation({
        cmhcDesignation: "AFFORDABLE",
        currentRent: Number(rec.unit.currentRent),
        proposedRent: Number(rec.proposedRent),
        cpiRatePercent: cpiRate ? Number(cpiRate.ratePercent) : null,
      });
      if (!check.allowed) {
        redirect(
          `/units/${rec.unitId}?error=${encodeURIComponent(check.reason!)}`,
        );
      }
    }

    await prisma.$transaction([
      prisma.unit.update({
        where: { id: rec.unitId },
        data: { currentRent: rec.proposedRent },
      }),
      prisma.rentRecommendation.update({
        where: { id },
        data: {
          decision: "APPROVED",
          decisionNote,
          decidedById: session!.user!.id,
          decidedAt: new Date(),
        },
      }),
    ]);
  } else {
    await prisma.rentRecommendation.update({
      where: { id },
      data: {
        decision: "DECLINED",
        decisionNote,
        decidedById: session!.user!.id,
        decidedAt: new Date(),
      },
    });
  }

  revalidatePath(`/units/${rec.unitId}`);
  redirect(`/units/${rec.unitId}`);
}
