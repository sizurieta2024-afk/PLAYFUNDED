# Live Validation Status

Updated: 2026-03-17

## Proven Live

- Ops health alerting:
  - live deploy returned a real unhealthy `/api/ops/health` response
  - GitHub Actions workflow dispatched successfully
  - temporary receiver captured the real alert body
- KYC malware quarantine path:
  - real `clamd` daemon scanned uploads
  - authenticated upload returned `file_malware_detected`
  - object was written to `kyc-quarantine`
  - quarantine event was persisted in `OpsEventLog`
- Admin positive smoke:
  - production-mode local build on port `3004`
  - `/en/admin`, `/en/admin/kyc`, `/en/admin/launch` all returned `200` for a real temporary admin session
- GitHub CI and launch smokes:
  - `workflow_dispatch` is proven on the remote repository
  - GitHub run `23133863176` completed successfully on commit `7a2f56c`
  - `launch-smokes` passed remotely, including:
    - `Admin smoke`
    - `Payout KYC smoke`
    - `Admin support smoke`

## Proven By Archive Validation

- Logical Postgres backup creation
- Archive readability via `pg_restore --list`
- Full restore into a disposable local Postgres target
- Restored key application table counts matched the backup snapshot

## Still Not Fully Proven

- Live production ops health is currently degraded, not green:
  - live `/api/ops/health` returned `503` on 2026-03-12
  - `odds_sync_recent` was failing
  - `cron_failures` reported `1`
- Permanent Slack/Discord alert destination, because no real `PF_ALERT_WEBHOOK_URL` / `PF_ALERT_WEBHOOK_KIND` is configured in GitHub
- Production Vercel KYC scanning, because production runtime still lacks `CLAMAV_*` and `KYC_*` scan env vars
- Full Supabase platform restore outside the application `public` schema
- Exact end-user browser copy for the KYC malware rejection, even though the route-level rejection path was proven

## Explicit Current KYC Runtime Status

- Intended production behavior: strict
- Effective behavior without ClamAV envs: uploads block, they do not silently pass
- Admin launch view should be read as:
  - `Mode require_clean`
  - `Scanner not configured`
