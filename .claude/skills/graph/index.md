---
title: PlayFunded Skill Graph
description: Entry point for agent traversal. Start here every session before touching code.
---

# PlayFunded

Spanish-first sports prop trading firm for Latin America. Users pay a challenge fee ($20–$499) to trade sports props with a simulated bankroll. They must pass Phase 1 (reach +20% profit) and Phase 2 (repeat) while obeying strict risk rules. Passing earns them a funded account where they keep 70–80% of simulated profits, paid monthly in real money.

## Core Domain
- [[challenge-lifecycle]] — how a challenge progresses from purchase to funded
- [[risk-rules]] — drawdown, stake cap, daily loss: the financial guardrails
- [[pick-settlement]] — placing picks and grading results against odds feed
- [[funded-trader-rules]] — extra rules that only apply in the funded phase
- [[odds-feed]] — provider interface, caching, polling strategy

## Architecture
- [[database-schema]] — Prisma entities, key constraints, monetary conventions
- [[auth-geo]] — Supabase auth, Google OAuth, USA geo-block
- [[payment-flow]] — Stripe + Mercado Pago + NOWPayments purchase flow
- [[provider-interfaces]] — swap-friendly pattern used for odds, chatbot, payments
- [[security-model]] — RLS, server-side admin checks, webhook validation

## Patterns & Conventions
- [[i18n-pattern]] — next-intl, es-419 first, no hardcoded strings ever
- [[money-convention]] — integer cents everywhere, never floats
- [[known-gotchas]] — non-obvious decisions a future agent must not miss
