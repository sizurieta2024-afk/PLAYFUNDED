# PostHog Launch Dashboard Setup

Date: 2026-05-14

Purpose: make the PlayFunded launch dashboard repeatable instead of relying on manual PostHog UI setup.

## Current State

Production event capture is configured in Vercel:

- `NEXT_PUBLIC_POSTHOG_TOKEN`
- `NEXT_PUBLIC_POSTHOG_HOST`

The app already emits launch-critical events for:

- auth verification
- checkout and payment confirmation
- first pick placement
- challenge groups
- affiliate applications
- payout and rollover intent

The remaining operational gap is the PostHog dashboard itself.

## Dashboard Created By Script

Script:

```sh
npm run posthog:dashboard:setup
```

Dry run:

```sh
npm run posthog:dashboard:setup -- --dry-run
```

Dashboard name:

```text
PlayFunded Launch Command Center
```

The script is idempotent:

- it searches for the dashboard by exact name
- it creates the dashboard if missing
- it searches for each insight by exact name
- it updates existing insights instead of creating duplicates

## Required Private PostHog Env

These are ops-only values and must never be exposed to the browser:

```sh
POSTHOG_API_HOST=https://eu.posthog.com
POSTHOG_ENVIRONMENT_ID=...
POSTHOG_PERSONAL_API_KEY=...
```

The personal API key needs only these scopes:

- `dashboard:read`
- `dashboard:write`
- `insight:read`
- `insight:write`

If these env vars are missing, the setup script fails before touching PostHog. It never prints the key.

## Dashboard Sections

The dashboard contains these saved insights:

- `01 Acquisition: traffic, locale, and buy intent`
- `02 Auth: signup to verified account`
- `03 Revenue: buy intent to paid challenge`
- `04 Activation: paid user to first useful action`
- `05 Groups: social feature adoption`
- `06 Affiliate: application to attributed revenue`
- `07 Payout intent and rollover behavior`

## What This Dashboard Answers

- Are visitors reaching the site and changing locale?
- Are users starting signup and completing email verification?
- Are users dropping before checkout or after checkout creation?
- Are confirmed payments arriving from the webhook?
- Do paid users place their first pick?
- Are challenge groups being created and joined?
- Is the affiliate launch producing applications and attributed payments?
- Are funded users asking for payout or rollover?

## Verification

Local proof:

```sh
npm run proof:posthog-dashboard
```

This proof checks that:

- the setup script can render a dry-run dashboard definition
- required PostHog API scopes are documented
- every dashboard event exists in `AnalyticsEvents`
- the package scripts are wired

## Launch Note

This script does not replace looking at the dashboard after launch. It gives us the first command center. After real users arrive, the dashboard should be refined based on actual drop-offs and support questions.
