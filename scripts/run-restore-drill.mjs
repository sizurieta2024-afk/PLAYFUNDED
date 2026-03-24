import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function resolveBin(name, candidates = []) {
  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return name;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

const postgresBin = process.env.RESTORE_POSTGRES_BIN_DIR;
const libpqBin = process.env.RESTORE_LIBPQ_BIN_DIR;
const pgCtl = resolveBin("pg_ctl", [
  process.env.PG_CTL_BIN,
  postgresBin ? path.join(postgresBin, "pg_ctl") : null,
  "/opt/homebrew/opt/postgresql@17/bin/pg_ctl",
]);
const createdb = resolveBin("createdb", [
  process.env.CREATEDB_BIN,
  postgresBin ? path.join(postgresBin, "createdb") : null,
  "/opt/homebrew/opt/postgresql@17/bin/createdb",
]);
const dropdb = resolveBin("dropdb", [
  process.env.DROPDB_BIN,
  postgresBin ? path.join(postgresBin, "dropdb") : null,
  "/opt/homebrew/opt/postgresql@17/bin/dropdb",
]);
const psql = resolveBin("psql", [
  process.env.PSQL_BIN,
  postgresBin ? path.join(postgresBin, "psql") : null,
  "/opt/homebrew/opt/postgresql@17/bin/psql",
]);
const pgRestore = resolveBin("pg_restore", [
  process.env.PG_RESTORE_BIN,
  libpqBin ? path.join(libpqBin, "pg_restore") : null,
  "/opt/homebrew/opt/libpq/bin/pg_restore",
]);

const backupRoot = "/tmp/playfunded-backups";
const backupArchive =
  process.env.BACKUP_ARCHIVE ??
  (() => {
    const dirs = fs
      .readdirSync(backupRoot)
      .sort()
      .reverse();
    if (dirs.length === 0) {
      throw new Error("No backup archive found under /tmp/playfunded-backups");
    }
    return path.join(backupRoot, dirs[0], "playfunded-prod.custom");
  })();
const manifestPath =
  process.env.BACKUP_MANIFEST ??
  path.join(path.dirname(backupArchive), "manifest.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : null;

const dataDir = process.env.RESTORE_PGDATA ?? "/opt/homebrew/var/postgresql@17";
const logFile = "/tmp/playfunded-restore-postgres.log";
const port = process.env.RESTORE_PORT ?? "55432";
const dbName = process.env.RESTORE_DB_NAME ?? "playfunded_restore_drill";

function psqlScalar(sql) {
  return run(
    psql,
    ["-h", "127.0.0.1", "-p", port, "-d", dbName, "-At", "-c", sql],
    { env: { ...process.env, PGDATABASE: dbName } },
  ).trim();
}

function psqlExec(sql) {
  return run(
    psql,
    ["-h", "127.0.0.1", "-p", port, "-d", dbName, "-v", "ON_ERROR_STOP=1", "-c", sql],
    { env: { ...process.env, PGDATABASE: dbName } },
  );
}

try {
  run(pgCtl, ["-D", dataDir, "-l", logFile, "-o", `-p ${port}`, "-w", "start"]);
  run(dropdb, ["-h", "127.0.0.1", "-p", port, "--if-exists", dbName]);
  run(createdb, ["-h", "127.0.0.1", "-p", port, dbName]);
  psqlExec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
      END IF;
    END
    $$;
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE OR REPLACE FUNCTION auth.uid()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    AS $$ SELECT '00000000-0000-0000-0000-000000000000'::uuid $$;
  `);
  run(pgRestore, [
    "-h",
    "127.0.0.1",
    "-p",
    port,
    "-d",
    dbName,
    "--schema=public",
    "--no-owner",
    "--no-privileges",
    backupArchive,
  ]);

  const counts = {
    users: Number(psqlScalar('SELECT COUNT(*) FROM "User";')),
    challenges: Number(psqlScalar('SELECT COUNT(*) FROM "Challenge";')),
    picks: Number(psqlScalar('SELECT COUNT(*) FROM "Pick";')),
    payments: Number(psqlScalar('SELECT COUNT(*) FROM "Payment";')),
    payouts: Number(psqlScalar('SELECT COUNT(*) FROM "Payout";')),
    kycSubmissions: Number(psqlScalar('SELECT COUNT(*) FROM "KycSubmission";')),
    opsEvents: Number(psqlScalar('SELECT COUNT(*) FROM "OpsEventLog";')),
  };
  const integrity = {
    challengeBalanceSum: Number(psqlScalar('SELECT COALESCE(SUM("balance"), 0) FROM "Challenge";')),
    challengeStartBalanceSum: Number(psqlScalar('SELECT COALESCE(SUM("startBalance"), 0) FROM "Challenge";')),
    paymentAmountSum: Number(psqlScalar('SELECT COALESCE(SUM("amount"), 0) FROM "Payment";')),
    completedPaymentAmountSum: Number(
      psqlScalar('SELECT COALESCE(SUM("amount"), 0) FROM "Payment" WHERE status = \'completed\';'),
    ),
    payoutAmountSum: Number(psqlScalar('SELECT COALESCE(SUM("amount"), 0) FROM "Payout";')),
    paidPayoutAmountSum: Number(
      psqlScalar('SELECT COALESCE(SUM("amount"), 0) FROM "Payout" WHERE status = \'paid\';'),
    ),
    pickStakeSum: Number(psqlScalar('SELECT COALESCE(SUM("stake"), 0) FROM "Pick";')),
    pickActualPayoutSum: Number(
      psqlScalar('SELECT COALESCE(SUM("actualPayout"), 0) FROM "Pick";'),
    ),
  };

  if (manifest?.counts) {
    for (const [key, value] of Object.entries(manifest.counts)) {
      if (counts[key] !== value) {
        throw new Error(`Count mismatch for ${key}: restored=${counts[key]} expected=${value}`);
      }
    }
  }
  if (manifest?.integrity) {
    for (const [key, value] of Object.entries(manifest.integrity)) {
      if (integrity[key] !== value) {
        throw new Error(
          `Integrity mismatch for ${key}: restored=${integrity[key]} expected=${value}`,
        );
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        backupArchive,
        manifestPath,
        restoreDb: dbName,
        port: Number(port),
        counts,
        integrity,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    run(dropdb, ["-h", "127.0.0.1", "-p", port, "--if-exists", dbName]);
  } catch {}
  try {
    run(pgCtl, ["-D", dataDir, "-m", "fast", "stop"]);
  } catch {}
}
