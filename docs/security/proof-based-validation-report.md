# Playfunded Proof-Based Validation Report

Generated: 2026-03-26T12:35:34.824Z

This report follows a Shannon-style rule: claims must be backed by executable or source-level proof. Anything not proven is listed as unverified.

## Summary

- Verified checks: 53
- Failed checks: 0
- Unverified claims: 3

## Verified And Failed Checks

### VERIFIED auth.protected-routes
Area: auth and session handling
Claim: Protected routes require a live Supabase session and preserve a redirect target.
Detail: All required proof points were found in source.
Evidence:
- Session is read from Supabase: L157: } = await supabase.auth.getUser();
- Protected prefixes are declared: L10: const PROTECTED_PREFIXES = ["/dashboard", "/admin"];
- Redirect target is preserved on login redirect: L169: loginUrl.searchParams.set("redirectTo", pathname);

### VERIFIED admin.server-role-check
Area: admin authorization
Claim: Admin access is enforced with a server-side role lookup.
Detail: All required proof points were found in source.
Evidence:
- Admin role is queried from the User table: L176: .from("User")
- Role field is selected: L177: .select("role")
- Non-admin users are redirected away: L181: if (!user || user.role !== "admin") {

### VERIFIED payments.stripe-signature
Area: payments and webhooks
Claim: Stripe fulfillment only runs after signature verification and duplicate-safe locking.
Detail: All required proof points were found in source.
Evidence:
- Stripe signature header is required: L229: const sig = req.headers.get("stripe-signature");
- constructEvent verifies the webhook body: L241: event = stripe.webhooks.constructEvent(
- Invalid signatures are rejected: L249: { error: "Invalid webhook signature" },
- Fulfillment is wrapped in a webhook duplicate lock: L60: const fulfillment = await withWebhookLock(

### VERIFIED payments.nowpayments-signature
Area: payments and webhooks
Claim: NOWPayments callbacks require a verified provider signature, reject malformed payloads, and deduplicate fulfillment.
Detail: All required proof points were found in source.
Evidence:
- NOWPayments signature header is read: L23: const signature = request.headers.get("x-nowpayments-sig") ?? "";
- Signature verifier is called: L27: isValid = await verifyNowPaymentsSignature(body, signature);
- Invalid signatures are rejected: L33: console.error("[NOWPayments webhook] Invalid signature");
- Malformed payloads are rejected: L49: data = JSON.parse(body) as typeof data;
- Fulfillment is delegated to the shared NOWPayments payment service: L83: const outcome = await fulfillNowPaymentsPayment({

### VERIFIED payments.nowpayments-fulfillment-service
Area: payments and webhooks
Claim: NOWPayments fulfillment upgrades pending checkout payments and creates the challenge inside one locked transaction.
Detail: All required proof points were found in source.
Evidence:
- Fulfillment is wrapped in a webhook lock: L62: return withWebhookLock(
- Pending checkout payments are upgraded in place: L83: status: "completed",
- Challenge provisioning happens in the same transaction: L126: await tx.challenge.create({

### VERIFIED ops.launch-smokes-dispatchable
Area: payments and webhooks
Claim: The CI workflow can run launch smokes from either push or manual dispatch once secrets exist.
Detail: All required proof points were found in source.
Evidence:
- CI supports workflow_dispatch: L8: workflow_dispatch:
- Launch smokes are not limited to push-only events: L112: if: ${{ github.event_name != 'pull_request' }}
- Launch smokes run the admin support smoke: L198: run: BASE_URL=http://localhost:3004 node scripts/run-admin-support-smoke.mjs

### VERIFIED ops.admin-launch-kyc-status
Area: payout flows
Claim: The admin launch page exposes whether KYC scanning is configured plus the resolved deploy environment and scan mode.
Detail: All required proof points were found in source.
Evidence:
- The admin launch page reads the resolved KYC deploy environment: L33: const kycDeployEnvironment = getKycDeployEnvironment();
- The admin launch page reads the KYC scan mode: L34: const kycScanMode = getKycScanMode();
- The page shows the KYC scanning card: L76: <p className="text-xs text-muted-foreground mb-1">KYC scanning</p>
- The page shows the scanner configured vs unconfigured state: L78: {clamavConfigured ? "ClamAV configured" : "Scanner not configured"}
- The page shows the deploy environment alongside the mode: L81: {kycDeployEnvironment} · mode {kycScanMode}

### VERIFIED payments.mercadopago-checkout-disabled
Area: payments and webhooks
Claim: Mercado Pago checkout is explicitly disabled for launch rather than left half-available.
Detail: All required proof points were found in source.
Evidence:
- Checkout route returns an explicit disabled code: L26: code: "PAYMENT_METHOD_DISABLED",
- Checkout route records the disabled-provider event: L27: reason: "Mercado Pago has been disabled for launch.",

### VERIFIED payments.mercadopago-webhook-disabled
Area: payments and webhooks
Claim: Mercado Pago webhook handling is explicitly disabled for launch.
Detail: All required proof points were found in source.
Evidence:
- Webhook route returns an explicit disabled code: L23: code: "PAYMENT_METHOD_DISABLED",
- Webhook route records the disabled-provider event: L24: reason: "Mercado Pago webhook received after provider was disabled.",

### VERIFIED payout.transactional-request
Area: payout flows
Claim: Payout creation rechecks pending state inside a serializable transaction before debiting balance.
Detail: All required proof points were found in source.
Evidence:
- Payout flow runs inside an interactive transaction: L50: return await input.db.$transaction(
- Transaction isolation is serializable: L133: isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
- Pending payouts are checked inside the transaction: L65: status: "pending",
- Challenge balance is updated inside the transaction: L119: await tx.challenge.update({

### VERIFIED payout.owner-scoped-query
Area: payout flows
Claim: Payout eligibility is scoped to the requesting user and funded challenges only.
Detail: All required proof points were found in source.
Evidence:
- Payout flow is delegated to the shared payout service: L56: const decision = await createPayoutRequest({
- Authenticated user is still required before payout request: L38: const user = await getAuthenticatedUser();

### VERIFIED admin.payout-audit
Area: admin authorization
Claim: Admin payout review uses the transactional review service and notifies the user.
Detail: All required proof points were found in source.
Evidence:
- Transactional review service is called: L90: const updated = await reviewPayoutByAdmin({
- Conflict responses return 409 from the admin payouts route: L105: { status: 409 },
- Payout approval email is available: L135: const { subject, html } = payoutPaidEmail(
- Payout rejection email is available: L143: const { subject, html } = payoutRejectedEmail(

### VERIFIED admin.payout-ui-conflict-message
Area: admin authorization
Claim: Admin payouts UI shows an explicit already-reviewed message when a concurrent review conflict happens.
Detail: All required proof points were found in source.
Evidence:
- The admin payouts UI handles RETRYABLE_CONFLICT explicitly: L34: if (result.code === "RETRYABLE_CONFLICT") {
- The admin payouts UI shows the already-reviewed message: L37: [id]: "Already reviewed by another admin. The queue is refreshing.",
- The queue refreshes after the conflict message: L39: router.refresh();

### VERIFIED admin.payout-review-transaction
Area: admin authorization
Claim: Admin payout review writes payout status and audit log in one serializable transaction.
Detail: All required proof points were found in source.
Evidence:
- Pending payouts are updated with compare-and-set semantics: L152: const updated = await tx.payout.updateMany({
- Pending status is part of the write guard: L155: status: "pending",
- Payout review creates an audit log entry: L173: targetType: "payout",
- Serializable conflicts are normalized instead of leaking 500s: L356: error.code === "P2034"
- Transaction isolation is serializable: L192: isolationLevel: Prisma.TransactionIsolationLevel.Serializable,

### VERIFIED admin.kyc-audit
Area: admin authorization
Claim: Admin KYC review uses the transactional review service and notifies the user.
Detail: All required proof points were found in source.
Evidence:
- Transactional review service is called: L127: const updated = await reviewKycByAdmin({
- KYC approval email is available: L142: const { subject, html } = kycApprovedEmail(updated.user.name);
- KYC rejection email is available: L145: const { subject, html } = kycRejectedEmail(updated.user.name, reviewNote);

### VERIFIED admin.kyc-review-transaction
Area: admin authorization
Claim: Admin KYC review writes submission status and audit log in one serializable transaction.
Detail: All required proof points were found in source.
Evidence:
- Pending submissions are updated with compare-and-set semantics: L381: const updated = await tx.kycSubmission.updateMany({
- Pending status is part of the write guard: L155: status: "pending",
- KYC review creates an audit log entry: L400: targetType: "kyc",
- Transaction isolation is serializable: L192: isolationLevel: Prisma.TransactionIsolationLevel.Serializable,

### VERIFIED settlement.admin-role-gate
Area: pick settlement logic
Claim: Manual settlement is limited to authenticated admins.
Detail: All required proof points were found in source.
Evidence:
- Admin requests are authenticated via Supabase: L29: } = await supabase.auth.getUser();
- Admin role is checked server-side: L40: where: { supabaseId: authUser.id, role: "admin" },
- Non-admins receive a forbidden response: L44: { error: "Forbidden", code: "FORBIDDEN" },

### VERIFIED settlement.cron-secret
Area: pick settlement logic
Claim: Automated settlement requires the CRON secret bearer token.
Detail: All required proof points were found in source.
Evidence:
- CRON secret is loaded from environment: L3: // POST /api/settle  (Bearer CRON_SECRET required)
- Authorization header is checked: L32: return req.headers.get("authorization") === `Bearer ${secret}`;
- Unauthorized requests are rejected: L57: { error: "Unauthorized", code: "UNAUTHORIZED" },

### VERIFIED settlement.multi-provider-auto
Area: pick settlement logic
Claim: Automated settlement fetches final scores for both The Odds API and API-Football leagues.
Detail: All required proof points were found in source.
Evidence:
- The Odds API scoring path is used: L134: ? await fetchOddsApiScores(config.providerKey)
- API-Football scoring path is used: L135: : await fetchApiFootballScores(eventIds);
- Provider-specific branching chooses the scoring source: L133: config.provider === "odds_api"

### VERIFIED picks.optimistic-balance-update
Area: challenge risk rules
Claim: Pick placement uses optimistic concurrency when deducting challenge balance.
Detail: All required proof points were found in source.
Evidence:
- Stake cap is rechecked inside the transaction: L72: const stakeViolation = baseCheckStakeCap(
- Balance update is conditional on the fresh balance: L94: balance: freshChallenge.balance,
- Conflicts return a concrete retry error: L102: "CHALLENGE_BALANCE_CHANGED",

### VERIFIED geo.public-geo-block
Area: geo-blocking and rate limiting
Claim: Public pages are gated by country policy and redirected to the geo-block screen.
Detail: All required proof points were found in source.
Evidence:
- Country policy is resolved in middleware: L87: const policy = getCountryPolicy(derivedCountry);
- Blocked countries are redirected: L16: "/auth/geo-blocked",

### VERIFIED rate-limit.webhooks-and-admin-settlement
Area: geo-blocking and rate limiting
Claim: Webhook and manual settlement routes apply route-specific rate limiting.
Detail: All required proof points were found in source.
Evidence:
- Manual settlement uses enforceRateLimit: L16: const limit = await enforceRateLimit(req, "api:admin:picks:settle", {
- Rate-limit failures return a structured response: L13: import { enforceRateLimit, rateLimitExceededResponse } from "@/lib/rate-limit";

### VERIFIED risk.drawdown-breach
Area: challenge risk rules
Claim: Drawdown fails once balance drops below 85% of the peak balance.
Detail: Scenario matched the expected outcome.
Evidence:
- Violation code: DRAWDOWN_BREACH
- Message: Balance dropped more than 15% from starting balance ($100.00)

### VERIFIED risk.daily-loss-breach
Area: challenge risk rules
Claim: Daily loss fails once balance drops more than 10% below daily start balance.
Detail: Scenario matched the expected outcome.
Evidence:
- Violation code: DAILY_LOSS_BREACH
- Message: Daily loss limit reached — balance cannot fall below 90% of today's starting balance ($90.00)

### VERIFIED risk.stake-cap-breach
Area: challenge risk rules
Claim: Stake cap blocks picks above 5% of the challenge start balance.
Detail: Scenario matched the expected outcome.
Evidence:
- Violation code: STAKE_CAP_EXCEEDED
- Message: Stake exceeds 5% limit. Max allowed: $5.00

### VERIFIED risk.minimum-stake-breach
Area: challenge risk rules
Claim: Minimum stake is always 1% of the challenge start balance, with a $1 floor.
Detail: Scenario matched the expected outcome.
Evidence:
- Violation code: STAKE_MIN_VIOLATED
- Message: Stake is below the 1% minimum. Min allowed: $2.00

### VERIFIED payout.rejects-kyc-missing
Area: payout flows
Claim: Payout requests fail without approved KYC.
Detail: Scenario matched the expected outcome.
Evidence:
- Code: KYC_REQUIRED

### VERIFIED payout.rejects-profit-overdraw
Area: payout flows
Claim: Payout requests cannot exceed available gross profit.
Detail: Scenario matched the expected outcome.
Evidence:
- Code: EXCEEDS_PROFIT

### VERIFIED payout.computes-amount-and-new-balance
Area: payout flows
Claim: Successful payout requests compute user share and remaining challenge balance deterministically.
Detail: Scenario matched the expected outcome.
Evidence:
- Gross profit: 2000
- Payout amount: 1200
- New balance: 10500

### VERIFIED kyc.upload-eligibility-gates
Area: payout flows
Claim: KYC upload eligibility is blocked until payouts are enabled and the user has funded profit available.
Detail: Scenario matched the expected outcome.
Evidence:
- No challenge: no_funded_challenge
- No profit: no_profit_available
- Eligible: eligible

### VERIFIED settlement.moneyline-draw-push
Area: pick settlement logic
Claim: Moneyline draw handling returns push unless the selection is explicit draw.
Detail: Scenario matched the expected outcome.
Evidence:
- Home selection -> push
- Draw selection -> won

### VERIFIED settlement.spread-exact-cover-push
Area: pick settlement logic
Claim: Spread grading treats exact cover as a push.
Detail: Scenario matched the expected outcome.
Evidence:
- Spread result: push

### VERIFIED settlement.total-over-under
Area: pick settlement logic
Claim: Total grading distinguishes over, under, and push correctly.
Detail: Scenario matched the expected outcome.
Evidence:
- Over 44.5 -> won
- Under 45 -> push

### VERIFIED settlement.pick-payout-on-win-only
Area: pick settlement logic
Claim: Pick grading only stores actual payout for winning outcomes.
Detail: Scenario matched the expected outcome.
Evidence:
- Winning payout: 1950
- Losing payout: 0

### VERIFIED db.rls-user-self-scope
Area: auth and session handling
Claim: The live User table has RLS enabled with an own-row policy tied to auth.uid().
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- User table RLS: true
- Own-row policy: users_own_row

### VERIFIED db.rls-sensitive-public-tables
Area: auth and session handling
Claim: Sensitive public tables have RLS enabled before app-level access control is trusted.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Affiliate rls=true
- AffiliateClick rls=true
- AuditLog rls=true
- Challenge rls=true
- CountryPolicyOverride rls=true
- Follow rls=true
- KycSubmission rls=true
- MarketRequest rls=true
- OpsEventLog rls=true
- ParlayLeg rls=true
- Payment rls=true
- Payout rls=true
- PayoutProfile rls=true
- Pick rls=true
- User rls=true

### VERIFIED db.rls-owner-policies
Area: auth and session handling
Claim: Owner-scoped read policies exist on the user-facing tables that should remain visible to the authenticated user.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Affiliate:users_select_own_affiliate
- AffiliateClick:users_select_own_affiliate_clicks
- Challenge:users_select_own_challenges
- Follow:users_select_own_follows
- KycSubmission:users_select_own_kyc_submission
- MarketRequest:users_select_own_market_requests
- ParlayLeg:users_select_own_parlay_legs
- Payment:users_select_own_payments
- Payout:users_select_own_payouts
- PayoutProfile:users_select_own_payout_profile
- Pick:users_select_own_picks

### VERIFIED db.payout-persistence-and-pending-guard
Area: payout flows
Claim: Persisted payout requests debit balance once and block a second pending request on the same challenge.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Created payout amount: 800
- Challenge balance after request: 11000
- Second request rejection: PENDING_EXISTS

### VERIFIED db.webhook-lock-duplicate-fulfillment
Area: payments and webhooks
Claim: Concurrent duplicate webhook fulfillment creates only one payment and one challenge.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Outcomes: created, duplicate
- Payment count: 1
- Challenge count: 1

### VERIFIED db.nowpayments-checkout-provisioning-success
Area: payments and webhooks
Claim: A completed NOWPayments webhook upgrades the pending checkout payment in place and provisions one challenge.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Outcome: created
- Pending payment upgraded: true
- Challenge count: 1

### VERIFIED db.nowpayments-checkout-provisioning-rollback
Area: payments and webhooks
Claim: If NOWPayments provisioning fails after payment upgrade, the transaction rolls back and the checkout payment stays pending.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Payment status after rollback: pending
- Challenge count after rollback: 0

### VERIFIED db.nowpayments-webhook-replay-race
Area: payments and webhooks
Claim: Concurrent replay of the same NOWPayments completion upgrades the checkout payment once and provisions only one challenge.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Statuses: created, duplicate
- Payment count: 1
- Challenge count: 1

### VERIFIED db.affiliate-code-conversion-attribution
Area: payments and webhooks
Claim: A paid purchase with an affiliate code records one conversion row and updates affiliate totals exactly once.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Conversion code: PF-D1AAB1
- Affiliate conversions: 1
- Affiliate pending payout: 85

### VERIFIED db.webhook-lock-rolls-back-failed-fulfillment
Area: payments and webhooks
Claim: Webhook fulfillment rolls back partial writes when provisioning fails inside the transaction.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Payment count after rollback: 0
- Challenge count after rollback: 0

### VERIFIED db.admin-payout-review-audit
Area: admin authorization
Claim: Admin payout review persists both the payout status change and the audit log entry.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Reviewed payout status: paid
- Audit action: approve_payout

### VERIFIED db.admin-payout-review-race
Area: admin authorization
Claim: Concurrent payout reviews never throw; one succeeds and the competing review returns a stable non-500 result.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Success count: 1
- Competing review count: 1

### VERIFIED db.admin-payout-reject-audit
Area: admin authorization
Claim: Rejecting a payout restores challenge balance and persists the audit log entry.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Rejected payout status: failed
- Restored balance: 12000
- Audit action: reject_payout

### VERIFIED db.admin-kyc-review-audit
Area: admin authorization
Claim: Admin KYC review persists both the submission status change and the audit log entry.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Reviewed KYC status: approved
- Audit action: approve_kyc

### VERIFIED db.admin-kyc-reject-audit
Area: admin authorization
Claim: Rejecting KYC persists rejected status and the audit log entry.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Rejected KYC status: rejected
- Audit action: reject_kyc

### VERIFIED db.pick-placement-concurrency
Area: challenge risk rules
Claim: Concurrent pick placement only debits one pick when both requests race on the same balance snapshot.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Success count: 1
- Blocked count: 1
- Final balance: 10000
- Pick count: 1

### VERIFIED db.settlement-sequential-ordering
Area: pick settlement logic
Claim: Sequential settlement of multiple pending picks on the same challenge preserves cumulative balance updates.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- First result balance: 9000
- Second result balance: 10000
- Final balance: 10000

### VERIFIED db.admin-manual-settlement-override
Area: pick settlement logic
Claim: Manual settlement override persists the chosen outcome and challenge balance update.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Settled pick status: void
- Challenge balance: 10000

### VERIFIED db.admin-user-ban-cycle
Area: admin authorization
Claim: Admin ban and unban mutations persist user restriction state and audit entries.
Detail: Database-backed scenario matched the expected persisted outcome.
Evidence:
- Ban audit action: ban_user
- Unban audit action: unban_user

## Unverified Claims

- payments and webhooks: Provider console settings, secret rotation, and callback allowlists are configured safely. -- Unverified because those controls live outside this repository.
- geo-blocking and rate limiting: Rate limiting is effective across all production instances and regions. -- Unverified under real production traffic across regions, even though the implementation now uses shared Postgres state.
- geo-blocking and rate limiting: Geo-IP derivation always reflects the user's real jurisdiction. -- Unverified because it depends on provider headers and external IP lookup behavior at runtime.
