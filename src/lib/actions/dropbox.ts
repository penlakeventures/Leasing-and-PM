"use server";

import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getActiveConnection } from "@/lib/dropbox";

export async function disconnectDropbox() {
  await prisma.dropboxConnection.deleteMany({});
  revalidatePath("/settings/dropbox");
  redirect("/settings/dropbox");
}

export async function updateDropboxBasePath(formData: FormData) {
  const basePath = (formData.get("basePath") as string)?.trim() || "";
  const connection = await getActiveConnection();
  if (!connection) redirect("/settings/dropbox");

  await prisma.dropboxConnection.update({
    where: { id: connection.id },
    data: { basePath: basePath.replace(/\/$/, "") },
  });

  revalidatePath("/settings/dropbox");
  redirect("/settings/dropbox");
}
