---
title: Provider Interfaces
description: The swap-friendly pattern used for odds, chatbot, and payments — how to add or replace a provider without touching the UI.
related: [odds-feed, payment-flow, database-schema]
---

# Provider Interfaces

Three systems in PlayFunded are explicitly designed to be provider-agnostic: the odds feed, the chatbot, and payment providers. The rule: **the UI layer never imports a provider directly**. It imports the interface. Provider implementations live in separate files.

## Why this matters
The chatbot may need to migrate from Claude API to Intercom as the user base grows. An odds provider may go out of business. Adding Mercado Pago to an existing Stripe checkout should not require touching the checkout UI. The interface pattern makes all of these changes a 1-file edit.

## Odds Provider Interface
`src/lib/odds/types.ts` defines `OddsProvider`. Implementations in `src/lib/odds/odds-api.ts` and `src/lib/odds/api-football.ts`. See [[odds-feed]] for full details.

## Chatbot Interface
`src/lib/chatbot/types.ts` defines `ChatProvider` with at minimum:
```typescript
interface ChatProvider {
  chat(messages: Message[], userLanguage: 'es' | 'en'): ReadableStream
}
```
`src/lib/chatbot/claude.ts` is the Claude API implementation. Swapping to Intercom = create `src/lib/chatbot/intercom.ts` and update one import in the chatbot component.

## Payment Abstraction
Payment providers are less formally interfaced because each has a different checkout UX (redirect vs QR code). However, the shared contract is: every provider webhook handler must (1) validate a signature, (2) find or create a `Payment` record, (3) call `createChallengeForPayment(paymentId)` — a shared function in `src/lib/challenge/create.ts`. The UI never calls payment logic directly.

## Key Details
- Provider selection can be environment-variable driven for A/B testing: `CHATBOT_PROVIDER=claude|intercom`
- Adding a new payment method = new route handler + new webhook handler + add option to checkout UI
- Never import `@anthropic-ai/sdk` outside of `src/lib/chatbot/claude.ts`
- Never import `stripe` outside of `src/lib/stripe.ts`

## Gotchas
- The chatbot must detect the user's language from context and respond in the same language — this is the provider's responsibility, not the UI's. Bake it into the `chat()` implementation.
