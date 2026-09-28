import { prisma } from "@/lib/prisma";

export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
}
