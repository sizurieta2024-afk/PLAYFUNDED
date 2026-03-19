# Provider Webhook Hardening

This checklist covers controls that matter for Playfunded's payment providers but cannot be fully proven from repository code alone.

## Verified in code

- Stripe webhook requests are signature-verified before fulfillment and fulfillment runs under a transaction-scoped duplicate lock.
- NOWPayments callbacks require signature verification, reject malformed JSON payloads, and fulfill under a transaction-scoped duplicate lock.
- Mercado Pago notifications require a shared token when configured, reconcile against provider API data with a bounded timeout, and fulfill under a transaction-scoped duplicate lock.

## Still unverified from code

- Stripe dashboard webhook endpoint secret matches `STRIPE_WEBHOOK_SECRET`.
- Mercado Pago notification URL secret is configured in the provider dashboard and rotated when credentials change.
- NOWPayments IPN secret matches `NOWPAYMENTS_IPN_SECRET`.
- Provider dashboards restrict callbacks to the intended production/staging URLs.
- Provider credentials are rotated and old secrets are revoked after rotation.

## Operator checks

1. Confirm each provider is pointing at the expected `https://.../api/webhooks/...` endpoint for the environment.
2. Rotate each webhook secret in the provider dashboard and update the matching environment variable without leaving old values active.
3. Verify replay behavior by resending a known completed event and confirming the app records a duplicate instead of creating a second payment/challenge.
4. Confirm provider alerts exist for repeated delivery failures or disabled webhook endpoints.
