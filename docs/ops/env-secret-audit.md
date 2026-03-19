# Launch Env And Secret Audit

Generated from `node scripts/audit-launch-env.mjs` on 2026-03-11.

Updated operational status: 2026-03-17.

## Scope

- Local `.env.local`
- GitHub Actions secrets
- Vercel production environment variables
- Secrets referenced by workflows in `.github/workflows`

## Current Result

### Local

- Required app runtime keys: present
- Recommended scan keys persisted in `.env.local`: missing
  - `KYC_SCAN_MODE`
  - `CLAMAV_HOST`
  - `CLAMAV_PORT`
  - `CLAMAV_TIMEOUT_MS`
  - `KYC_QUARANTINE_BUCKET`
- Asset storage keys: now documented in `.env.example`

### GitHub Actions

- Required workflow secrets: present
  - `PF_BASE_URL`
  - `PF_CRON_SECRET`
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
- Optional alerting secrets: currently absent
  - `PF_ALERT_WEBHOOK_URL`
  - `PF_ALERT_WEBHOOK_KIND`

### Vercel Production

- Required app runtime keys: present
- Recommended production scan keys: absent
  - `KYC_SCAN_MODE`
  - `CLAMAV_HOST`
  - `CLAMAV_PORT`
  - `CLAMAV_TIMEOUT_MS`
  - `KYC_QUARANTINE_BUCKET`

## Operational Meaning

- Ops health checking is configured and can run from GitHub Actions today.
- External alerting is not active right now because there is still no permanent Slack/Discord webhook destination configured in GitHub.
- The `CI` workflow has the secrets needed for `launch-smokes`, and that job is now proven on GitHub for both `workflow_dispatch` and remote branch execution.
- Production KYC scanning is not active on Vercel because the runtime has no ClamAV connection settings.
- Production KYC behavior is therefore strict-by-default: if `KYC_SCAN_MODE` stays unset in production, uploads block unless ClamAV is available because the app now defaults production to `require_clean`.
- Local KYC scanning was proven only by injecting scan env vars at runtime during the live validation session.
- The audit script treats alert-webhook secrets as optional even though the workflow can reference them on failure paths.
- GitHub Actions workflow files have been upgraded off Node 20 action runtimes to remove the hosted-runner deprecation warnings.
- KYC scan defaults are now environment-aware, not `NODE_ENV`-only:
  - production defaults to `require_clean`
  - staging, preview, and development default to `best_effort`
  - `APP_ENV` or `KYC_SCAN_MODE` can still override the default explicitly

## Recommended Next Actions

1. Set a real `PF_ALERT_WEBHOOK_URL` and `PF_ALERT_WEBHOOK_KIND` in GitHub once you have the permanent Slack/Discord destination.
2. Keep production KYC in strict mode unless you intentionally choose `best_effort` as a temporary override.
3. Let preview/staging/internal environments stay `best_effort` unless you are explicitly testing strict production behavior.
4. Persist the ClamAV/KYC scan env vars in the real production environments when you are ready to arm upload scanning.
5. Re-run `CI` and `ops-health-5m` after workflow edits so the Node 20 deprecation warnings stay gone on future runs.
