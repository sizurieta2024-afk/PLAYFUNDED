import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  // Seed challenge tiers
  // Fees and bankrolls stored in USD cents
  const tiers = [
    {
      name: 'Starter $1K',
      fee: 2000,           // $20 USD
      fundedBankroll: 100000,  // $1,000 USD
      profitSplitPct: 70,
      minPicks: 15,
      guideIncluded: false,
      sortOrder: 1,
    },
    {
      name: 'Pro $5K',
      fee: 9900,           // $99 USD
      fundedBankroll: 500000,  // $5,000 USD
      profitSplitPct: 75,
      minPicks: 15,
      guideIncluded: true,
      sortOrder: 2,
    },
    {
      name: 'Elite $10K',
      fee: 19900,          // $199 USD
      fundedBankroll: 1000000, // $10,000 USD
      profitSplitPct: 80,
      minPicks: 15,
      guideIncluded: true,
      sortOrder: 3,
    },
    {
      name: 'Champion $25K',
      fee: 49900,          // $499 USD
      fundedBankroll: 2500000, // $25,000 USD
      profitSplitPct: 80,
      minPicks: 15,
      guideIncluded: true,
      sortOrder: 4,
    },
  ]

  for (const tier of tiers) {
    await prisma.tier.upsert({
      where: { name: tier.name },
      update: tier,
      create: tier,
    })
    console.log(`✓ Tier: ${tier.name} — $${tier.fee / 100} entry → $${tier.fundedBankroll / 100} funded`)
  }

  console.log('\n✅ Seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
