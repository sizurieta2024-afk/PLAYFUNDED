import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export const ROOT = process.cwd();
export const SOCIAL_DIR = path.join(ROOT, "automation", "social");
export const QUEUES_DIR = path.join(SOCIAL_DIR, "queues");
export const GENERATED_DIR = path.join(SOCIAL_DIR, "generated");
export const STATE_DIR = path.join(SOCIAL_DIR, "state");
export const LOGS_DIR = path.join(SOCIAL_DIR, "logs");

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
    } else {
      args._.push(token);
    }
  }
  return args;
}

export async function ensureDirs() {
  await fs.mkdir(QUEUES_DIR, { recursive: true });
  await fs.mkdir(GENERATED_DIR, { recursive: true });
  await fs.mkdir(STATE_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

export async function loadJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function saveJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

export function relToRoot(absPath) {
  return path.relative(ROOT, absPath);
}

export function resolveFromRoot(relPath) {
  return path.resolve(ROOT, relPath);
}

export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function prompt(question) {
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

function parseDotEnv(raw) {
  const map = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    map[key] = value;
  }
  return map;
}

export async function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  try {
    const raw = await fs.readFile(envPath, "utf8");
    const values = parseDotEnv(raw);
    for (const [key, value] of Object.entries(values)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
    return values;
  } catch {
    return {};
  }
}

export async function appendLog(line) {
  await ensureDirs();
  const file = path.join(LOGS_DIR, "social.log");
  await fs.appendFile(file, `${new Date().toISOString()} ${line}\n`, "utf8");
}
