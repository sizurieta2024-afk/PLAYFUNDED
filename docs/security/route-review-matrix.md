# Route Review Matrix

Use this matrix whenever a new route, server action, or webhook is added. The goal is not paperwork. The goal is to force the same security questions every time money, auth, or admin logic changes.

## Review Questions

- `Auth bypass`: does the route require a logged-in user or a signed webhook secret?
- `Admin-only`: if this is privileged, is the admin check enforced server-side?
- `Ownership`: does the route scope reads and writes to the current user instead of trusting an ID from the client?
- `Input validation`: is request body/query input validated with `zod` or equivalent?
- `XSS/injection`: are user-controlled strings rendered safely and are raw SQL / dynamic HTML / redirect targets avoided?
- `Rate limit`: is the route behind the shared DB-backed limiter if it is externally reachable?
- `Observability`: does the route emit ops events or route metrics when it matters?

## Current High-Risk Route Coverage

| Route / Flow | Auth bypass | Admin-only | Ownership | Input validation | XSS / injection | Rate limit | Observability | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/checkout/stripe` | Yes | N/A | Yes | Yes (`zod`) | Safe by construction | Yes | Yes | Country/policy checks and discount validation are server-side. |
| `POST /api/checkout/nowpayments` | Yes | N/A | Yes | Yes (`zod`) | Safe by construction | Yes | Yes | Country/policy and discount validation stay server-side. |
| `POST /api/picks` | Yes | N/A | Yes | Yes (`zod`) | Safe by construction | Yes | Yes | Challenge ownership, event lock, odds drift, and stake rules are server-enforced. |
| `GET /api/picks` | Yes | N/A | Yes | Yes (`uuid`) | Safe by construction | N/A | Yes | Challenge ownership is rechecked before returning picks. |
| `POST /api/chat` | Yes | N/A | Session-scoped | Yes (`zod`) | Safe by construction | Yes | Yes | Input is bounded and auth stays server-side. |
| `POST /api/webhooks/stripe` | Signature verified | N/A | Provider metadata only | Provider payload | Safe by construction | Yes | Yes | Duplicate lock and webhook failure events exist. |
| `POST /api/webhooks/nowpayments` | Signature verified | N/A | Provider payload only | JSON parse only | Safe by construction | Yes | Yes | Duplicate lock and webhook completion events exist. |
| `POST /api/admin/kyc` | Yes | Yes | N/A | Yes (`zod`) | Safe by construction | Yes | Yes | Review input is bounded and role-checked server-side. |
| `POST /api/settle` | Bearer `CRON_SECRET` | N/A | N/A | N/A | Safe by construction | Internal only | Yes | Provider reads are now classified and timed. |
| `POST /api/payouts/sync` | Bearer `CRON_SECRET` | N/A | N/A | N/A | Safe by construction | Internal only | Yes | Provider status sync is timed and emits cron metrics. |
| `POST /api/admin/payouts` | Yes | Yes | Yes | Yes (`zod`) | Safe by construction | Yes | Yes | Conflict path stays explicit (`409`) under races. |
| `POST /api/admin/picks/settle` | Yes | Yes | N/A | Yes (`zod`) | Safe by construction | Yes | Yes | Manual settlement remains a privileged fallback. |
| `POST /api/kyc/upload` | Yes | N/A | Yes | Multipart + signature validation | Safe by construction | Existing gating | Yes | Production blocks uploads unless scanning is armed. |
| `/dashboard/challenge/[id]` and picks flow | Yes | N/A | Yes | Server-side lookup | Safe rendering | UI/API both guarded | Existing ops events | Continue checking ownership whenever new challenge actions are added. |

## Required Review Trigger

Re-run this review whenever you add or materially change:

- a payment route
- a webhook
- an admin action
- a server action that writes money, KYC, affiliate, or challenge state
- a route that accepts user-supplied identifiers, HTML, markdown, files, or redirect targets

If a new route cannot be mapped cleanly into this table, that is a signal to review it before shipping.
