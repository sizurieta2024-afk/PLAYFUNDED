import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function resolveBin(name, fallback) {
  const candidate = fallback ?? name;
  if (fs.existsSync(candidate)) return candidate;
  return name;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

const directUrl = process.env.DIRECT_URL;
if (!directUrl) {
  throw new Error("DIRECT_URL is required");
}

const pgDump = resolveBin("pg_dump", "/opt/homebrew/opt/libpq/bin/pg_dump");
const pgRestore = resolveBin("pg_restore", "/opt/homebrew/opt/libpq/bin/pg_restore");

const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll(".", "-");
const backupDir = path.join("/tmp", "playfunded-backups", timestamp);
fs.mkdirSync(backupDir, { recursive: true });

const archivePath = path.join(backupDir, "playfunded-prod.custom");
const tocPath = path.join(backupDir, "playfunded-prod.toc.txt");
const manifestPath = path.join(backupDir, "manifest.json");

async function collectIntegritySignals() {
  const [
    challengeSums,
    paymentSums,
    completedPaymentSums,
    payoutSums,
    paidPayoutSums,
    pickSums,
  ] = await Promise.all([
    prisma.challenge.aggregate({
      _sum: { balance: true, startBalance: true },
    }),
    prisma.payment.aggregate({
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { status: "completed" },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { status: "paid" },
      _sum: { amount: true },
    }),
    prisma.pick.aggregate({
      _sum: { stake: true, actualPayout: true },
    }),
  ]);

  return {
    challengeBalanceSum: challengeSums._sum.balance ?? 0,
    challengeStartBalanceSum: challengeSums._sum.startBalance ?? 0,
    paymentAmountSum: paymentSums._sum.amount ?? 0,
    completedPaymentAmountSum: completedPaymentSums._sum.amount ?? 0,
    payoutAmountSum: payoutSums._sum.amount ?? 0,
    paidPayoutAmountSum: paidPayoutSums._sum.amount ?? 0,
    pickStakeSum: pickSums._sum.stake ?? 0,
    pickActualPayoutSum: pickSums._sum.actualPayout ?? 0,
  };
}

try {
  run(pgDump, [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    "--file",
    archivePath,
    directUrl,
  ]);

  const toc = run(pgRestore, ["--list", archivePath]);
  fs.writeFileSync(tocPath, toc);

  const stats = fs.statSync(archivePath);
  const sha256 = crypto.createHash("sha256").update(fs.readFileSync(archivePath)).digest("hex");

  const [users, challenges, picks, payments, payouts, kycSubmissions, opsEvents] =
    await Promise.all([
      prisma.user.count(),
      prisma.challenge.count(),
      prisma.pick.count(),
      prisma.payment.count(),
      prisma.payout.count(),
      prisma.kycSubmission.count(),
      prisma.opsEventLog.count(),
    ]);
  const integrity = await collectIntegritySignals();

  const manifest = {
    generatedAt: new Date().toISOString(),
    archivePath,
    tocPath,
    archiveSizeBytes: stats.size,
    sha256,
    counts: {
      users,
      challenges,
      picks,
      payments,
      payouts,
      kycSubmissions,
      opsEvents,
    },
    integrity,
    verifiedBy: {
      pgDump,
      pgRestore,
    },
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  await prisma.$disconnect();
}
