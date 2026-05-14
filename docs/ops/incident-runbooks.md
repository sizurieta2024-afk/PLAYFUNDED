# Incident Runbooks

This is the operational first-response guide for PlayFunded launch-critical failures.

## 1. Odds Sync Failure

Signal:
- `/api/ops/health` shows `odds_sync_recent = false`
- GitHub workflow `odds-sync-10m.yml` is missing scheduled runs or fails
- `OpsEventLog` contains `cron_odds_sync_failed`

First checks:
- Confirm `ODDS_API_KEY` and `API_FOOTBALL_KEY` still exist in Vercel.
- Call `/api/odds/sync` manually with `CRON_SECRET`.
- Check recent `cron_odds_sync_failed` events and provider-specific error text.
- Confirm GitHub `Odds Sync` is scheduled at minutes `3,13,23,33,43,53`.
- If high-frequency Vercel Cron is required, upgrade the Vercel account from Hobby to Pro first.

Containment:
- Freeze public messaging that implies fresh odds if sync has been stale for more than one cycle.
- Keep pick placement closed if stale-market risk is unclear.

Recovery:
- Fix provider key, quota, or timeout issue.
- Re-run `/api/odds/sync`.
- Confirm `/api/ops/health` shows a recent sync success.

## 2. Settle Failure

Signal:
- `/api/ops/health` shows `settle_recent = false`
- GitHub workflow `settle-5m.yml` fails
- `OpsEventLog` contains `cron_settle_failed`

First checks:
- Call `/api/settle` manually with `CRON_SECRET`.
- Review recent settlement errors in `OpsEventLog`.
- Check whether failures are provider-score fetch failures or DB concurrency issues.

Containment:
- Do not approve payouts based on stale funded balances.
- Pause any manual balance adjustments until settlement is caught up.

Recovery:
- Fix the fetch or DB issue.
- Re-run `/api/settle`.
- Confirm a fresh `cron_settle_completed` event exists, including the no-op path.

## 3. Webhook Failure Or Duplicate Spike

Signal:
- `/api/ops/health` shows webhook failures or duplicate spike
- `OpsEventLog` contains `webhook_handler_failed` or many `webhook_duplicate`

First checks:
- Identify provider: Stripe or NOWPayments. Mercado Pago is disabled for launch, so any live Mercado Pago traffic should be treated as unexpected and investigated.
- Check signature verification, provider fetch errors, and duplicate lock behavior.
- Confirm provider dashboard delivery status.
- For NOWPayments, check whether the original checkout already created a `pending` `Payment` row for the same `providerRef`.

Containment:
- Do not replay blindly if fulfillment state is uncertain.
- Check `Payment.providerRef` and existing `Challenge` creation before replay.

Recovery:
- Replay the provider event only after verifying idempotency state.
- Confirm a single successful fulfillment event and no duplicate challenge creation.
- NOWPayments replay checklist:
  - If `Payment.providerRef` exists with `status = completed`, treat the replay as duplicate and do not create a manual adjustment.
  - If `Payment.providerRef` exists with `status = pending`, confirm whether the webhook upgraded that row or rolled back entirely before replaying.
  - If no `Payment.providerRef` exists, confirm the provider event payload still maps to the expected `tierId` and `userId`.

Launch note:
- A launch-ready checkout should pass `npm run smoke:payments`, which proves initiation on the enabled rails and confirms that checkout creation alone does not grant a challenge.

## 4. Payout Queue Blockage

Signal:
- Admin payout page shows stuck pending payouts
- User reports requested payout without progress

First checks:
- Confirm KYC status and funded challenge profit state.
- Review `Payout` records, `AuditLog`, and recent payout ops events.
- Check whether country policy disabled the selected payout method.
- Check whether another admin already reviewed the same payout and the UI/API returned a conflict.

Containment:
- Stop manual status changes without an audit note.
- Keep a single operator responsible for each payout incident.

Recovery:
- Add the missing admin note / tx ref / policy decision.
- If processor issue, move affected payouts to a known fallback lane or hold state with documented reason.
- If review races occur:
  - Refresh the queue first.
  - Treat `RETRYABLE_CONFLICT` / `409` as "another admin won the race", not as a payout-system failure.
  - Verify the final `Payout.status` and matching `AuditLog` row before retrying.

## 5. KYC Upload Scan Or Quarantine Issue

Signal:
- User sees upload rejection
- `OpsEventLog` contains `kyc_upload_quarantined`, `kyc_upload_quarantine_failed`, or `kyc_upload_failed`

First checks:
- Inspect `scanStatus`, `scanMode`, `scanEngine`, and `scanSignature` in `OpsEventLog`.
- Confirm `CLAMAV_HOST` connectivity if scanning is expected.
- Confirm the `kyc-quarantine` bucket exists and is writable.

Containment:
- Do not manually move quarantined files into the accepted KYC bucket.
- If scanner is unavailable in `require_clean` mode, treat uploads as blocked until service is restored.

Recovery:
- Restore scanner or quarantine bucket connectivity.
- Re-test with a safe sample file.
- Only ask the user to re-upload after confirming the path is healthy.

Mode note:
- Production currently defaults to `require_clean` if `KYC_SCAN_MODE` is unset.
- Staging, preview, and internal environments default to `best_effort` unless `KYC_SCAN_MODE` or `APP_ENV` overrides that behavior.
- If `CLAMAV_*` is not configured in production, KYC uploads are expected to block, not degrade silently.
- `npm run smoke:kyc-strict` is the quickest proof that this blocking behavior still holds on a production-like runtime.

## 6. Alerting Disabled Or Misconfigured

Signal:
- `/api/ops/health` can fail, but no Slack/Discord alert arrives
- GitHub workflow `ops-health-5m.yml` shows failed alert delivery or missing webhook config

First checks:
- Confirm `PF_ALERT_WEBHOOK_URL` and `PF_ALERT_WEBHOOK_KIND` exist in GitHub Actions secrets.
- Check the `ops-health-5m.yml` run log for the captured `/api/ops/health` response body.
- Confirm `PF_CRON_SECRET` still matches the app’s `CRON_SECRET`.

Containment:
- Keep relying on GitHub workflow failures and manual `/api/ops/health` checks until alert delivery is restored.
- Do not assume “no alert” means “healthy.”

Recovery:
- Reconfigure the alert webhook destination.
- Re-run the GitHub workflow manually.
- Verify the alert body contains the actual failing health payload, not just a generic workflow error.
- For a controlled test, run `gh workflow run ops-health-5m.yml -f force_alert=true -f alert_message="Controlled ops alert test"`.

## 7. Launch-Smoke CI Failure

Signal:
- GitHub Actions `CI` workflow `launch-smokes` job fails
- Admin, payout/KYC, or admin-support smoke starts failing on preview/branch validation

First checks:
- Confirm the six required GitHub repo secrets still exist:
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
- Confirm the `CI` workflow was triggered by `push` or `workflow_dispatch`, not a pull request.
- Confirm the workflow run is using the expected branch head/commit, not an older dispatch or stale rerun.
- Inspect `/tmp/playfunded-ci.log` from the workflow artifacts/logs if app startup failed.

Containment:
- Treat a failing launch smoke as a release blocker for admin/payment-control-plane changes.
- Do not disable the smoke job to force green CI without documenting the exact reason.

Recovery:
- Re-run the `CI` workflow manually once the secrets and build issue are corrected.
- Verify `smoke:admin`, `smoke:payout-kyc`, and `smoke:admin-support` all pass in the same run.
- Treat exact-copy failures in smoke checks as lower-signal than behavioral failures:
  - prefer proving auth, redirects, upload-button visibility, and API rejection/acceptance behavior
  - only require exact UI copy when the wording itself is operationally important
