import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const OUTPUT_DIR = path.join(process.cwd(), "automation", "exports");

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function formatDateForFile(date) {
  return date.toISOString().slice(0, 10);
}

const columns = [
  "email",
  "country",
  "locale",
  "ref",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "utmContent",
  "utmTerm",
  "submissionCount",
  "lastSubmittedAt",
  "createdAt",
  "updatedAt",
];

try {
  const leads = await prisma.bioLead.findMany({
    orderBy: [{ createdAt: "desc" }],
  });

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outputPath = path.join(
    OUTPUT_DIR,
    `bio-leads-${formatDateForFile(new Date())}.csv`,
  );
  const rows = [
    columns.map(csvCell).join(","),
    ...leads.map((lead) => columns.map((column) => csvCell(lead[column])).join(",")),
  ];

  fs.writeFileSync(outputPath, `${rows.join("\n")}\n`);
  console.log(`Exported ${leads.length} bio leads to ${outputPath}`);
} finally {
  await prisma.$disconnect();
}
