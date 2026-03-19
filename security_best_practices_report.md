# PlayFunded Pre-Public Security Audit

Date: 2026-03-04
Repo: `sizurieta2024-afk/PLAYFUNDED`
Default branch: `dev`
Visibility: Public

## Executive Summary
This audit was run against the current `playfunded` workspace and GitHub repo settings. Result: **2 PASS, 2 PARTIAL, 6 FAIL** on the public-repo readiness checklist.

The strongest blockers before safely keeping this public are:
1. No enforced CI/branch protection on default branch.
2. Production dependency vulnerabilities (including high severity in `next` and `prisma` dependency tree).
3. Incomplete legal/compliance package for public launch.
4. Missing `SECURITY.md` disclosure process.

## 10-Point Checklist Status

1. **Secrets scan passes**: **PARTIAL**
- Evidence:
  - `gitleaks` git history scan: no leaks (`26 commits scanned`, report `[]`).
  - `gitleaks` working tree scan: `307` leaks found, concentrated in ignored build artifacts (`.next/*`) and local files (`.env.local`, `tests/e2e/global.setup.ts`).
- Why partial:
  - Committed history appears clean.
  - Working tree still contains sensitive material that could be accidentally committed.

2. **All leaked/old secrets rotated**: **FAIL**
- Evidence:
  - Rotation state cannot be proven from repo code alone.
  - Known provider keys currently invalid in prod odds sync (operational issue found in previous run logs), indicating key management is still in flux.
- Required proof missing:
  - Rotation log/inventory for Vercel/GitHub/Supabase/payment providers.

3. **No production credentials in repo**: **PARTIAL**
- Evidence:
  - Tracked files: no hardcoded live secrets found; only `.env.example` template is tracked.
  - `.gitignore` includes `.env*.local` and `.next/` (good).
  - Local file has hardcoded credentials: [`tests/e2e/global.setup.ts`](/Users/sebastianizurieta/playfunded/tests/e2e/global.setup.ts:14) and [`tests/e2e/global.setup.ts`](/Users/sebastianizurieta/playfunded/tests/e2e/global.setup.ts:17).
- Why partial:
  - Current git history is clean.
  - Local untracked credentials still create accidental-commit risk.

4. **Cron/admin endpoints hardened**: **FAIL**
- Evidence:
  - Cron auth exists (Bearer secret): [`src/app/api/settle/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/settle/route.ts:21), [`src/app/api/odds/sync/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/odds/sync/route.ts:15), [`src/app/api/cron/daily-reset/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/cron/daily-reset/route.ts:15).
  - Admin auth/role checks exist: [`src/app/api/admin/payouts/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/admin/payouts/route.ts:5), [`src/app/api/admin/kyc/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/admin/kyc/route.ts:5), [`src/middleware.ts`](/Users/sebastianizurieta/playfunded/src/middleware.ts:143).
  - No app-level rate-limiting implementation found (`rg` found no rate-limit middleware/guard).
  - No CSP/CORS/security-header implementation found in app config (empty `next.config`): [`next.config.mjs`](/Users/sebastianizurieta/playfunded/next.config.mjs:6).
- Impact:
  - Public endpoints are more exposed to brute force/abuse than launch baseline.

5. **Payment/webhook safety verified**: **PARTIAL**
- Evidence:
  - Stripe webhook verifies signature: [`src/app/api/webhooks/stripe/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/webhooks/stripe/route.ts:175), [`src/app/api/webhooks/stripe/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/webhooks/stripe/route.ts:187).
  - NOWPayments webhook verifies HMAC signature: [`src/app/api/webhooks/nowpayments/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/webhooks/nowpayments/route.ts:12), [`src/lib/nowpayments.ts`](/Users/sebastianizurieta/playfunded/src/lib/nowpayments.ts:87).
  - Mercado Pago webhook does not validate an incoming shared secret/signature header; it relies on fetching payment by ID from MP API: [`src/app/api/webhooks/mercadopago/route.ts`](/Users/sebastianizurieta/playfunded/src/app/api/webhooks/mercadopago/route.ts:52).
- Why partial:
  - Two providers are strong.
  - Mercado Pago path is less strict than a signed webhook model.

6. **PII/user data not exposed in git**: **PASS**
- Evidence:
  - No customer DB dumps, no raw KYC docs, no inbox exports in tracked files.
  - Found only support/business emails and code-level metadata references.
- Note:
  - Runtime logs can still include user identifiers; monitor production logging policy.

7. **Dependency/security audit clean**: **FAIL**
- Evidence (`npm audit --omit=dev --json`):
  - Total: `10` vulnerabilities (`5 high`, `5 moderate`).
  - Includes high severity advisories in `next` and dependency chain under `prisma`.
- Impact:
  - Fails “clean audit” requirement for public launch.

8. **CI mandatory on default branch**: **FAIL**
- Evidence:
  - Only scheduled cron workflows exist in `.github/workflows` (no build/lint/test PR gate).
  - GitHub API: default branch `dev`, branch protection missing (`Branch not protected` HTTP 404).
  - GitHub rulesets API returns `[]`.
- Impact:
  - Direct pushes can bypass testing/review.

9. **Legal/compliance files present**: **FAIL**
- Evidence:
  - Legal page exists with short summaries: [`src/app/[locale]/(main)/legal/page.tsx`](/Users/sebastianizurieta/playfunded/src/app/[locale]/(main)/legal/page.tsx:34).
  - Root legal artifacts missing (`LICENSE`, standalone Terms/Privacy docs not present in repo root).
- Impact:
  - Public repo/commercial launch compliance posture is incomplete.

10. **Responsible disclosure ready (`SECURITY.md`)**: **FAIL**
- Evidence:
  - No `SECURITY.md` in repo root.
- Impact:
  - No documented process for external vulnerability reporting.

## Findings by Severity

### High
- **F-001**: Default branch has no protection/rulesets, and CI is not enforced.
- **F-002**: Dependency audit not clean (`5 high` vulnerabilities in production dependency graph).

### Medium
- **F-003**: Endpoint hardening incomplete (missing visible rate limiting / security header baseline).
- **F-004**: Mercado Pago webhook lacks explicit inbound signature validation model.
- **F-005**: Working tree contains local credentials in untracked files; accidental commit risk.
- **F-006**: Legal/compliance package incomplete for public/commercial posture.

### Low
- **F-007**: Missing `SECURITY.md` vulnerability disclosure process.

## Recommended Remediation Order (Before Public Launch)
1. Add CI workflow(s) for lint/build/tests and enforce branch protection on `dev`.
2. Resolve `npm audit` production vulnerabilities (upgrade `next`, review `prisma` dependency strategy).
3. Add `SECURITY.md`, `LICENSE`, and fuller legal docs (Terms + Privacy + jurisdiction/risk disclaimers).
4. Remove hardcoded e2e credentials from local test setup and move to env vars.
5. Add runtime rate limiting for sensitive/public costed endpoints (`/api/chat`, checkout/webhook paths).
6. Strengthen Mercado Pago webhook trust model (signed secret/header validation if available).

