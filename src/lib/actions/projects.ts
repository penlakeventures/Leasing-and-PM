"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function parseProjectForm(formData: FormData) {
  const occupancyDateRaw = formData.get("occupancyDate") as string;
  return {
    internalName: (formData.get("internalName") as string).trim(),
    websiteCode: (formData.get("websiteCode") as string).trim(),
    neighbourhood: (formData.get("neighbourhood") as string).trim(),
    address: (formData.get("address") as string).trim(),
    occupancyDate: occupancyDateRaw ? new Date(occupancyDateRaw) : new Date(),
    cmhcLoanRef: (formData.get("cmhcLoanRef") as string)?.trim() || null,
  };
}

export async function createProject(formData: FormData) {
  const data = parseProjectForm(formData);

  try {
    await prisma.projectEntity.create({ data });
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

  try {
    await prisma.projectEntity.update({ where: { id }, data });
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
