# Supabase Exposure Audit

Generated from current Playfunded application code and live development database checks.

## What Is Actually Exposed Through Supabase Today

Observed application usage:

- `User` is queried via Supabase in middleware to resolve the authenticated user's role for `/admin` route gating.
- Browser-side Supabase usage in current UI code is limited to `auth.signOut()`.
- Storage signed-URL generation uses the service-role client for KYC documents.
- Application data reads and writes for payouts, picks, KYC, affiliates, admin queues, and settlement currently run through Prisma, not Supabase table queries.

## Priority Assessment

1. High priority
   - `KycSubmission`
   - `Payout`
   - `Payment`
   - `PayoutProfile`
   - `Challenge`
   - `Pick`

Reason:
- These contain money-moving, identity, or core challenge-balance state.
- If any future route, RPC, or client query reaches them through Supabase without RLS, tenant boundaries depend entirely on app code.

2. Medium priority
   - `Affiliate`
   - `AffiliateClick`
   - `MarketRequest`
   - `Follow`
   - `ParlayLeg`

Reason:
- These are user-scoped or indirectly user-scoped, but less critical than payouts, KYC, and balances.

3. Backend-only sensitive tables
   - `AuditLog`
   - `CountryPolicyOverride`
   - `OpsEventLog`

Reason:
- End users should not access these through Supabase at all.
- RLS should still be enabled so accidental exposure is denied at the database layer.

## Implementation Direction

- Keep `User` own-row policy intact.
- Enable RLS on the remaining sensitive public tables.
- Add owner-read policies only where current or likely future user access is reasonable.
- Keep money-moving and admin-sensitive writes behind server code and service-role access.
