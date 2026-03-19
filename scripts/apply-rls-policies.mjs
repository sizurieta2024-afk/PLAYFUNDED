import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sqlPath = path.join(root, "supabase-rls-policies.sql");
const envPath = path.join(root, ".env.local");

function readDatabaseUrl(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("DATABASE_URL=")) {
      return line.slice("DATABASE_URL=".length).trim();
    }
  }
  return null;
}

const databaseUrl = process.env.DATABASE_URL ?? readDatabaseUrl(envPath);
if (!databaseUrl) {
  console.error("DATABASE_URL not found in environment or .env.local");
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, "utf8");
const client = new Client({ connectionString: databaseUrl });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied ${path.basename(sqlPath)}`);
} finally {
  await client.end().catch(() => {});
}
