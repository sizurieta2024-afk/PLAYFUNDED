# Backup And Restore Drill

Run date: 2026-03-11

## What Was Executed

Command:

```bash
node --env-file=.env.local scripts/run-backup-drill.mjs
node --env-file=.env.local scripts/run-restore-drill.mjs
```

## Result

- Backup archive created: `/tmp/playfunded-backups/2026-03-11T224521-977Z/playfunded-prod.custom`
- Table-of-contents file created: `/tmp/playfunded-backups/2026-03-11T224521-977Z/playfunded-prod.toc.txt`
- Archive size: `310595` bytes
- SHA-256: `dfb3982cf3af30ce3902b48b4ebecb4290d3255b76a9e550c1e6579bf703b669`
- Verification command used by script: `pg_restore --list`

## Snapshot Counts At Backup Time

- Users: `4`
- Challenges: `1`
- Picks: `4`
- Payments: `2`
- Payouts: `0`
- KYC submissions: `0`
- Ops events: `18`

## What This Proves

- `DIRECT_URL` was usable for logical backup.
- `pg_dump` successfully produced a valid custom-format archive.
- `pg_restore --list` could read the archive, so the artifact is not corrupt at creation time.
- A disposable local Postgres target on port `55432` could restore the `public` schema from the archive.
- Restored key table counts matched the backup manifest:
  - Users: `4`
  - Challenges: `1`
  - Picks: `4`
  - Payments: `2`
  - Payouts: `0`
  - KYC submissions: `0`
  - Ops events: `18`
- Restored money-critical aggregate signals matched the backup manifest:
  - Challenge balance sum
  - Challenge start-balance sum
  - Payment amount sum
  - Completed payment amount sum
  - Payout amount sum
  - Paid payout amount sum
  - Pick stake sum
  - Pick actual-payout sum

## What Is Still Unverified

- This is a local Mac/Homebrew-based drill, not a portable restore workflow for every environment.
- This drill restores the application `public` schema only, not the full Supabase platform schemas.
- The restore harness uses local compatibility shims for Supabase-specific roles and `auth.uid()` to validate app-data recovery outside Supabase.
- The default paths still assume a local Postgres installation unless you set `RESTORE_POSTGRES_BIN_DIR`, `RESTORE_LIBPQ_BIN_DIR`, `RESTORE_PGDATA`, or the individual `PG_CTL_BIN` / `PSQL_BIN` / `PG_RESTORE_BIN` overrides.

## Next Upgrade

Extend the drill to compare a broader set of integrity signals, such as:

1. checksums or row samples for money-critical tables
2. restore timing thresholds and size thresholds
3. documented Supabase-specific restore procedure for full platform recovery
