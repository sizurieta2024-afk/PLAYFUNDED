---
title: Payment Flow
description: How challenge purchases work across all three providers — Stripe (cards), Mercado Pago (LATAM), NOWPayments (crypto).
related: [challenge-lifecycle, database-schema, security-model, provider-interfaces]
---

# Payment Flow

Three separate payment providers, each with its own webhook that creates a `Challenge` record on success. All providers share the same post-payment outcome: a `Payment` record is created and a `Challenge` record is created (or gift token is stored).

## All payments are in USD
Never charge in local currency. Local currency is display only (`$20 USD (~$340 MXN)` format). Exchange rates fetched daily from exchangerate-api.com and cached in memory or a simple DB row.

## Stripe (Cards)
- Create a Stripe Checkout Session server-side with `tierId` in metadata
- Redirect user to Stripe-hosted checkout
- `src/app/api/webhooks/stripe/route.ts` handles `payment_intent.succeeded`
- Validate Stripe signature header on every webhook — reject if invalid
- Idempotency: check if `Payment.providerRef` already exists before creating challenge

## Mercado Pago (LATAM)
- Create an MP Preference with `tierId` in external_reference
- User completes payment on MP-hosted page
- `src/app/api/webhooks/mercadopago/route.ts` handles `payment` notification
- Validate webhook signature via `MERCADOPAGO_WEBHOOK_SECRET`

## NOWPayments (Crypto — USDT/USDC TRC-20, BTC)
- `src/app/api/checkout/crypto/route.ts` creates NP payment, returns wallet address + expiry (20 min)
- Frontend shows QR code + address + countdown timer via `CryptoCheckout` component
- `src/app/api/webhooks/nowpayments/route.ts` handles `payment_status` IPN
- Validate HMAC signature using `NOWPAYMENTS_IPN_SECRET`
- Network: TRC-20 (Tron) for USDT/USDC — lowest fees for LATAM users

## Gift Purchases
`Payment.isGift = true`, `Payment.giftRecipientEmail` set, `Payment.giftToken` is a unique redemption UUID. On redemption (`/redeem/[token]`), the recipient logs in and a `Challenge` is created for them. Affiliate commission still applies to gift purchases.

## Key Details
- `Payment.amount` is always USD cents — [[money-convention]]
- Affiliate attribution: check cookie for `ref` code before creating Payment, record `AffiliateClick.conversionAmount` and `commissionEarned`
- Self-excluded users: block checkout entirely — check `User.selfExcludedUntil` before creating session
- Weekly deposit limit: check rolling 7-day `Payment` sum before allowing purchase

## Gotchas
- NOWPayments payments expire in 20 minutes. If the user doesn't pay in time, the challenge is NOT created. They must start a new checkout.
- Stripe webhook events can arrive out of order. Always check `Payment.status` before processing.
- MP webhook sometimes fires before the user returns from the payment page — the webhook, not the return URL, is the source of truth for challenge creation.
