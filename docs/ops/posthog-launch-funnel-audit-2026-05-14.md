# PostHog Launch Funnel Audit

Date: 2026-05-14

Purpose: define what PlayFunded must measure at launch and compare that against the current implementation.

## Current Implementation

Files checked:

- `src/instrumentation-client.ts`
- `src/components/analytics/PostHogAnalytics.tsx`
- `src/lib/posthog.ts`
- `src/providers/providers.tsx`

Current behavior:

- PostHog initializes when `NEXT_PUBLIC_POSTHOG_TOKEN` or `NEXT_PUBLIC_POSTHOG_KEY` is present.
- Host defaults to `https://eu.i.posthog.com`.
- `$pageview` is captured manually.
- route changes are tracked through `history.pushState`, `history.replaceState`, and `popstate`.
- `$pageleave` is enabled.
- authenticated users are identified by Supabase user ID.
- user identity properties currently include locale only.
- session recording is disabled unless `NEXT_PUBLIC_POSTHOG_SESSION_REPLAY=true`.
- text and element attributes are masked.

Current gap:

- there are no custom product funnel events for signup, checkout, payment, first pick, groups, affiliate, or payout behavior.

## Launch Funnel To Measure

| Step | Event name | Where it should fire | Status |
|---|---|---|---|
| Landing viewed | `$pageview` | Existing PostHog pageview | Present |
| Locale selected | `locale_selected` | Language toggle | Missing |
| CTA clicked | `landing_cta_clicked` | Landing/challenges/public affiliate CTA | Missing |
| Signup started | `signup_started` | Auth signup form submit | Missing |
| Signup verification sent | `signup_verification_sent` | Signup server action success | Missing |
| Email verified | `email_verified` | Auth callback verification path | Missing |
| Login succeeded | `login_succeeded` | Auth login success | Missing |
| Challenge viewed | `challenge_tier_viewed` | Challenge/pricing cards | Missing |
| Checkout started | `checkout_started` | Before API checkout call | Missing |
| Checkout created | `checkout_created_client` | After checkout URL returned | Missing client-side; present server-side as `OpsEventLog` |
| Payment completed | `payment_completed` | Webhook or safe server-side event bridge | Missing in PostHog; present as `OpsEventLog` |
| Dashboard viewed after purchase | `paid_dashboard_viewed` | Dashboard with active challenge | Missing |
| First pick placed | `first_pick_placed` | Pick API success or client success | Missing |
| Group created | `group_created` | Group create action success | Missing |
| Group joined | `group_joined` | Group join action success | Missing |
| Affiliate page viewed | `$pageview` | Existing PostHog pageview | Present |
| Affiliate application submitted | `affiliate_application_submitted` | Affiliate apply action success | Missing |
| Payout request started | `payout_request_started` | Payout CTA/form | Missing |
| Payout requested | `payout_requested` | Payout server action success | Missing in PostHog; present as ops event |

## Recommended Event Properties

Use properties that help decisions without exposing sensitive data.

Common properties:

- `locale`
- `country`
- `path`
- `source`
- `tier_id`
- `tier_name`
- `payment_method`
- `is_gift`
- `discount_code_present`
- `affiliate_code_present`
- `challenge_id`
- `group_id`
- `status`

Do not send:

- raw email
- raw payment IDs
- KYC document paths
- payout wallet addresses
- secret tokens
- exact support message bodies

## Implementation Recommendation

### First pass: client-side events

Add a small analytics helper around `posthog.capture`:

- `src/lib/analytics/client.ts`

Use it in:

- language toggle
- landing CTAs
- auth forms
- pricing/challenge CTA
- checkout client flow
- group create/join UI
- affiliate apply UI

### Second pass: server-confirmed events

Do not rely only on client events for money/payout truth.

For confirmed events, either:

- mirror selected `OpsEventLog` events into PostHog server-side, or
- create a small server analytics adapter that captures safe events after DB writes.

Candidate server-confirmed events:

- payment completed
- challenge created
- first pick placed
- payout requested
- affiliate application submitted
- group created/joined

### Third pass: dashboards

Create PostHog dashboard sections:

1. Acquisition
   - visitors by locale/source
   - landing CTA click rate
2. Auth
   - signup started
   - verification sent
   - email verified
   - login succeeded
3. Revenue
   - tier viewed
   - checkout started
   - checkout URL created
   - payment completed
4. Activation
   - dashboard viewed after purchase
   - first pick placed
   - first group action
5. Retention
   - return after 1 day
   - return after 7 days
   - active challenge users
6. Affiliate
   - affiliate page views
   - applications
   - approved affiliates
   - affiliate-attributed payments

## Launch Questions This Should Answer

- Which locale converts best?
- Which channel creates verified users?
- Where do users drop before checkout?
- Which tier gets clicked most?
- Which payment method fails most?
- How many paid users place a first pick?
- Do groups increase activation?
- Do affiliate users convert differently?
- Are people confused before checkout or after purchase?

## Priority

Before public traffic:

1. add CTA and checkout-start events
2. add signup/verify/login events
3. add first-pick and group events
4. create a launch funnel dashboard

After soft launch:

1. add server-confirmed payment and payout analytics
2. add affiliate attribution analytics
3. add retention cohorts
4. add session replay sampling only if privacy/legal posture permits it

## Go / No-Go

Go with current PostHog setup only for a very small soft launch.

No-go for broad paid traffic until:

- checkout-start is measured
- signup-to-verify is measured
- payment completion can be reconciled with Stripe/admin
- first-pick activation is measured
