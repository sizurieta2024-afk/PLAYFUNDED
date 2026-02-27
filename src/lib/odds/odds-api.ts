// ============================================================
// THE ODDS API adapter
// Handles: NBA, NFL, EPL, Serie A, Bundesliga, UCL, UFC, Tennis
// Docs: https://the-odds-api.com/lts-odds-api/
// ============================================================

import type { OddsEvent, Market, Outcome, OddsProvider, LeagueConfig } from "./types";
import { LEAGUE_CONFIG } from "./types";

const BASE_URL = "https://api.the-odds-api.com/v4";
const MARKETS = "h2h,spreads,totals"; // moneyline, spread, over/under
const ODDS_FORMAT = "decimal";
const REGIONS = "us,eu,uk";

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY not set");
  return key;
}

interface OddsApiBookmaker {
  key: string;
  markets: {
    key: string;
    outcomes: { name: string; price: number; point?: number }[];
  }[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

function extractMarkets(bookmakers: OddsApiBookmaker[]): Market[] {
  // Use Bet365 if available, otherwise first available bookmaker
  const bookmaker =
    bookmakers.find((b) => b.key === "bet365") ?? bookmakers[0];
  if (!bookmaker) return [];

  return bookmaker.markets
    .map((m): Market | null => {
      if (m.key === "h2h") {
        return {
          type: "moneyline",
          key: m.key,
          outcomes: m.outcomes.map(
            (o): Outcome => ({ name: o.name, odds: o.price }),
          ),
        };
      }
      if (m.key === "spreads") {
        return {
          type: "spread",
          key: m.key,
          outcomes: m.outcomes.map(
            (o): Outcome => ({ name: o.name, odds: o.price, point: o.point }),
          ),
        };
      }
      if (m.key === "totals") {
        return {
          type: "total",
          key: m.key,
          outcomes: m.outcomes.map(
            (o): Outcome => ({ name: o.name, odds: o.price, point: o.point }),
          ),
        };
      }
      return null;
    })
    .filter((m): m is Market => m !== null);
}

export class OddsApiProvider implements OddsProvider {
  name = "odds_api";

  getSupportedLeagues(): LeagueConfig[] {
    return LEAGUE_CONFIG.filter((l) => l.provider === "odds_api");
  }

  async getEvents(sport: string, league: string): Promise<OddsEvent[]> {
    const config = LEAGUE_CONFIG.find(
      (l) => l.sport === sport && l.league === league && l.provider === "odds_api",
    );
    if (!config) return [];

    const url = new URL(`${BASE_URL}/sports/${config.providerKey}/odds`);
    url.searchParams.set("apiKey", getApiKey());
    url.searchParams.set("regions", REGIONS);
    url.searchParams.set("markets", MARKETS);
    url.searchParams.set("oddsFormat", ODDS_FORMAT);
    url.searchParams.set("dateFormat", "iso");

    const res = await fetch(url.toString(), {
      next: { revalidate: 0 }, // always fresh in cron context
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OddsAPI error (${config.providerKey}): ${res.status} ${err}`);
    }

    const data = (await res.json()) as OddsApiEvent[];

    return data.map((event): OddsEvent => ({
      id: event.id,
      sport,
      league,
      leagueDisplay: config.leagueDisplay,
      homeTeam: event.home_team,
      awayTeam: event.away_team,
      startTime: new Date(event.commence_time),
      isLive: new Date(event.commence_time) <= new Date(),
      markets: extractMarkets(event.bookmakers),
    }));
  }
}
