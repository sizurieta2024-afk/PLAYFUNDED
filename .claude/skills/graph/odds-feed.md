---
title: Odds Feed
description: How odds are fetched, cached, and served. Provider interface design and LATAM coverage strategy.
related: [pick-settlement, funded-trader-rules, provider-interfaces, database-schema]
---

# Odds Feed

The odds feed is the external data dependency that powers pick placement and settlement. It uses the [[provider-interfaces]] pattern — the app never calls a provider directly, always via an adapter.

## Provider Decision (OPEN — confirm before Session 6)
See `.claude/memory/ODDS_DECISION.md` for full analysis. Current recommendation:

- **The Odds API** for: NBA, NFL, EPL, Serie A, Bundesliga, UCL, UFC, Tennis
- **API-Football** for: Liga MX, Copa Libertadores, Liga Argentina, LaLiga, Liga BetPlay, MLS

Combined cost: ~$95–150/month at launch. Both providers are low-friction to sign up (no approval process).

## Interface
All odds code must implement `OddsProvider` in `src/lib/odds/types.ts`:
```typescript
interface OddsProvider {
  getEvents(sport: string, league: string): Promise<Event[]>
  getOdds(eventId: string): Promise<Market[]>
  pollLive(eventId: string): Promise<Market[]>
}
```
Swapping providers = replacing one adapter file. See [[provider-interfaces]].

## Caching Strategy
Raw odds are never served directly to the frontend. Everything flows through `OddsCache` in [[database-schema]]:

- Pre-game events: poll every 10 minutes
- Live events: poll every 60 seconds
- Cache key: `sport + league + event + startTime` (composite unique constraint in DB)
- Frontend reads from `OddsCache`, never from the provider API directly

## Key Details
- Odds stored as **decimal floats** in `OddsCache.markets` JSON (e.g. 2.50, not +150)
- Display toggle to American odds is client-side conversion only — never stored as American
- Required bet types: moneyline, spread/handicap, totals (over/under), player props
- Bet365 odds are the reference standard for our LATAM market

## Gotchas
- `OddsCache.startTime` is used for the funded user 30-minute lock — if this is stale, funded users can place picks they shouldn't. Keep the cache warm.
- Liga BetPlay Colombia and Copa Libertadores are NOT covered by The Odds API — API-Football is required for those. Don't drop the two-provider approach.
- Store `provider` field on each cache row so you can identify which data is stale when one provider goes down
