# Decision: Sports Odds Data Source
Status: OPEN — blocker for Session 6

## Required Leagues
- Liga MX, LaLiga, EPL, Serie A, Bundesliga, UCL, Copa Libertadores, Liga Argentina, Liga BetPlay Colombia, MLS, NBA, NFL, UFC, Tennis ATP/WTA

## Options

### 1. The Odds API (theoddsapi.com)
- **Cost:** Free tier (500 requests/month), paid from ~$79/month
- **Coverage:** Strong US/EU leagues, partial LATAM (no Copa Libertadores, no Liga BetPlay)
- **API Quality:** Excellent REST API, well documented
- **Verdict:** Good for NBA/NFL/EPL — insufficient LATAM coverage alone

### 2. Sportradar
- **Cost:** Enterprise, contact for startup pricing (typically $500+/month)
- **Coverage:** Full coverage including all LATAM leagues
- **API Quality:** Industry standard, real-time, full market types
- **Verdict:** Best quality but likely cost-prohibitive at launch

### 3. API-Football (api-football.com)
- **Cost:** Free tier (100 calls/day), Pro from $15/month
- **Coverage:** Excellent LATAM football (Liga MX, Copa Libertadores, Liga Argentina, Liga BetPlay)
- **API Quality:** Strong for football only, no basketball/NFL/UFC
- **Verdict:** Best LATAM football supplement — combine with The Odds API

### 4. BetsAPI
- **Cost:** $30-80/month depending on plan
- **Coverage:** Wide league coverage including LATAM, live odds
- **API Quality:** Good, supports Bet365 odds mirroring
- **Verdict:** Strong candidate for Bet365-mirrored odds with LATAM coverage

### 5. SportsDataIO
- **Cost:** From $50/month
- **Coverage:** US-focused (NBA, NFL strong), limited LATAM football
- **Verdict:** Good for NBA/NFL, weak for our core LATAM use case

## Recommended Strategy (PENDING CONFIRMATION)
**Combination approach:**
1. **The Odds API** for: NBA, NFL, EPL, Serie A, Bundesliga, UCL, UFC, Tennis
2. **API-Football** for: Liga MX, Copa Libertadores, Liga Argentina, LaLiga, Liga BetPlay Colombia, MLS

Estimated cost: ~$95-150/month at launch
Bet365 mirroring: achievable via The Odds API's Bet365-sourced data

## Decision Criteria
- Liga MX, Copa Libertadores, Liga Argentina coverage ← critical
- Bet365-mirrored odds quality
- Cost at scale
- Real-time capability (60s live polling)

## Action Required Before Session 6
- Verify The Odds API current LATAM coverage (check latest docs)
- Verify API-Football has market types: ML, spread, totals, props
- Check if BetsAPI covers all required leagues at lower single-provider cost
- Make final decision and update this file status to DECIDED

## Architecture Note
Odds provider MUST be behind an interface:
```typescript
interface OddsProvider {
  getEvents(sport: string, league: string): Promise<Event[]>
  getOdds(eventId: string): Promise<Market[]>
  pollLive(eventId: string): Promise<Market[]>
}
```
This allows swapping providers without touching the UI.
