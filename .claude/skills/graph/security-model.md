---
title: Security Model
description: RLS policies, server-side admin checks, webhook signature validation, and rate limiting — security ships with each feature, not as a separate audit.
related: [auth-geo, database-schema, payment-flow, known-gotchas]
---

# Security Model

Security is not a session 21 audit. Every feature ships with its security controls. This file documents the patterns to apply consistently.

## Row Level Security (RLS)
Every Supabase table has RLS enabled. The default policy is deny-all. Policies are written alongside the feature code, not after.

Standard user policy pattern:
```sql
CREATE POLICY "users_own_data" ON "User"
  FOR ALL USING (auth.uid() = "supabaseId");
```

Admin bypass: admin operations use `createServiceClient()` from `src/lib/supabase.ts` which uses the service role key and bypasses RLS. Never use the service client in client components.

## Server-Side Admin Checks
Every `/admin` route and every admin API endpoint must verify `user.role = admin` via a Prisma query using the service client. Never trust the client to send a role claim. The middleware does a lightweight check, but each endpoint re-verifies independently.

Pattern in every admin route:
```typescript
const user = await prisma.user.findUnique({ where: { supabaseId: session.user.id } })
if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
```

## Webhook Signature Validation
Every payment webhook validates the provider signature before doing anything:
- **Stripe**: `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`
- **NOWPayments**: HMAC-SHA512 of request body using `NOWPAYMENTS_IPN_SECRET`
- **Mercado Pago**: validate `x-signature` header

Raw body must be used for validation — never parse JSON first. Use `req.text()` not `req.json()` in webhook handlers.

## Rate Limiting
Apply on: auth endpoints, pick placement, payout requests. Implementation: middleware-based using IP + user ID as key. Keep it simple — an in-memory store with Vercel Edge is sufficient at launch.

## Key Details
- KYC documents stored in a private Supabase Storage bucket — no public URL ever
- CSP headers and CORS config via Next.js middleware (`next.config.mjs`)
- All env vars in `.env.local` — gitignored. `.env.example` has keys only, no values.
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never in `NEXT_PUBLIC_` prefix

## Gotchas
- The service role key bypasses RLS completely. One mistake exposing it client-side = full database access to any user.
- Self-exclusion check must happen at checkout (prevent purchase) AND at pick placement (prevent playing). Two separate enforcement points.
