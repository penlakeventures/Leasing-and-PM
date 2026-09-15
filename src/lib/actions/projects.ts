"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseProjectForm(formData: FormData) {
  const occupancyDateRaw = formData.get("occupancyDate") as string;
  const displayOrderRaw = formData.get("displayOrder") as string;
  return {
    internalName: (formData.get("internalName") as string).trim(),
    websiteCode: (formData.get("websiteCode") as string).trim(),
    neighbourhood: (formData.get("neighbourhood") as string).trim(),
    address: (formData.get("address") as string).trim(),
    occupancyDate: occupancyDateRaw ? new Date(occupancyDateRaw) : new Date(),
    cmhcLoanRef: (formData.get("cmhcLoanRef") as string)?.trim() || null,
    displayOrder: displayOrderRaw ? Number(displayOrderRaw) : null,
  };
}

export async function createProject(formData: FormData) {
  const data = parseProjectForm(formData);

  // Left blank: land at the end of the list, not at the front (the
  // column's default is 0, which would otherwise jump a new project ahead
  // of everything).
  let displayOrder = data.displayOrder;
  if (displayOrder === null) {
    const last = await prisma.projectEntity.findFirst({
      orderBy: { displayOrder: "desc" },
    });
    displayOrder = (last?.displayOrder ?? 0) + 1;
  }

  try {
    await prisma.projectEntity.create({ data: { ...data, displayOrder } });
  } catch {
    redirect(
      `/projects/new?error=${encodeURIComponent("Could not save — check that the internal name and website code are unique.")}`,
    );
  }

  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProject(id: string, formData: FormData) {
  const data = parseProjectForm(formData);
  // The field is pre-filled with the current value, but guard against a
  // blank submission anyway — displayOrder isn't nullable in the schema,
  // so leave it untouched rather than sending an invalid null.
  const { displayOrder, ...rest } = data;

  try {
    await prisma.projectEntity.update({
      where: { id },
      data: displayOrder === null ? rest : { ...rest, displayOrder },
    });
  } catch {
    redirect(
      `/projects/${id}?error=${encodeURIComponent("Could not save — check that the internal name and website code are unique.")}`,
    );
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  redirect("/projects");
}

export async function deleteProject(id: string) {
  try {
    await prisma.projectEntity.delete({ where: { id } });
  } catch {
    redirect(
      `/projects/${id}?error=${encodeURIComponent("Can't delete a project that still has units attached to it.")}`,
    );
  }
  revalidatePath("/projects");
  redirect("/projects");
}
