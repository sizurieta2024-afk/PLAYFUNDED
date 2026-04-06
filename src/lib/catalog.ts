import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

export const getActiveTiers = unstable_cache(
  async () =>
    prisma.tier.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ["tiers:active"],
  {
    revalidate: 300,
    tags: ["tiers:active"],
  },
);
