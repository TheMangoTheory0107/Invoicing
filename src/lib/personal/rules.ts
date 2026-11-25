import { prisma } from "@/lib/prisma";

// Remember "merchant → category" so future imports label it automatically.
export async function learnRules(pairs: { key: string; categoryId: string }[]) {
  const unique = new Map<string, string>();
  for (const p of pairs) if (p.key.length >= 2) unique.set(p.key, p.categoryId);
  for (const [pattern, categoryId] of Array.from(unique)) {
    await prisma.personalMerchantRule.upsert({
      where: { pattern },
      create: { pattern, categoryId },
      update: { categoryId },
    });
  }
  return unique.size;
}
