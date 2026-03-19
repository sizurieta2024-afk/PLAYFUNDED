import { PrismaClient } from "@prisma/client";

function uniqueUrls(...urls) {
  return [...new Set(urls.filter(Boolean))];
}

function buildCandidates() {
  return uniqueUrls(process.env.DIRECT_URL, process.env.DATABASE_URL);
}

export function createPrismaSmokeClient(url) {
  return url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
}

async function tryConnect(url, attempts, delayMs) {
  const prisma = createPrismaSmokeClient(url);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await prisma.$connect();
      return prisma;
    } catch (error) {
      lastError = error;
      await prisma.$disconnect().catch(() => {});
      if (attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  lastError.connectionUrl = url ?? "env-default";
  throw lastError;
}

export async function connectPrismaWithRetry(options = {}) {
  const attempts = options.attempts ?? 3;
  const delayMs = options.delayMs ?? 1_000;
  const candidates = options.urls?.length ? uniqueUrls(...options.urls) : buildCandidates();
  const urlsToTry = candidates.length > 0 ? candidates : [undefined];

  let lastError;
  for (const url of urlsToTry) {
    try {
      return await tryConnect(url, attempts, delayMs);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
