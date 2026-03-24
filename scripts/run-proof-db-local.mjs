import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const envFile = path.join(root, ".env.local");

function readDatabaseUrl(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    if (line.startsWith("DATABASE_URL=")) {
      return line.slice("DATABASE_URL=".length).trim();
    }
  }
  return null;
}

if (!fs.existsSync(envFile)) {
  console.error(`Missing env file: ${envFile}`);
  process.exit(1);
}

const databaseUrl = readDatabaseUrl(envFile);
if (!databaseUrl) {
  console.error(`DATABASE_URL not found in ${envFile}`);
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ["-r", "ts-node/register/transpile-only", "scripts/validate-proof-based.js"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      VALIDATE_PROOF_DB: "1",
      TS_NODE_COMPILER_OPTIONS: JSON.stringify({
        module: "CommonJS",
        moduleResolution: "node",
      }),
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
