import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tiers = [
    {
      name: "Starter",
      fee: 1999, // $19.99 USD
      fundedBankroll: 50000, // $500 USD
      profitSplitPct: 70,
      minPicks: 15,
      guideIncluded: false,
      sortOrder: 1,
    },
    {
      name: "Pro",
      fee: 4699, // $46.99 USD
      fundedBankroll: 150000, // $1,500 USD
      profitSplitPct: 72,
      minPicks: 15,
      guideIncluded: false,
      sortOrder: 2,
    },
    {
      name: "Elite",
      fee: 12999, // $129.99 USD
      fundedBankroll: 450000, // $4,500 USD
      profitSplitPct: 75,
      minPicks: 15,
      guideIncluded: true,
      sortOrder: 3,
    },
    {
      name: "Master",
      fee: 29999, // $299.99 USD
      fundedBankroll: 1100000, // $11,000 USD
      profitSplitPct: 80,
      minPicks: 20,
      guideIncluded: true,
      sortOrder: 4,
    },
    {
      name: "Legend",
      fee: 67999, // $679.99 USD
      fundedBankroll: 2500000, // $25,000 USD
      profitSplitPct: 80,
      minPicks: 20,
      guideIncluded: true,
      sortOrder: 5,
    },
  ];

  // Delete old tiers first to avoid stale data
  await prisma.tier.deleteMany({
    where: {
      name: { in: ["Starter $1K", "Pro $5K", "Elite $10K", "Champion $25K"] },
    },
  });

  for (const tier of tiers) {
    await prisma.tier.upsert({
      where: { name: tier.name },
      update: tier,
      create: tier,
    });
    console.log(
      `✓ ${tier.name} — $${tier.fee / 100} entry → $${tier.fundedBankroll / 100} funded @ ${tier.profitSplitPct}%`,
    );
  }

  console.log("\n✅ Seed complete — 5 tiers");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
