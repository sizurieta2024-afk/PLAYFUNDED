// ============================================================
// API-FOOTBALL adapter (api-sports.io)
// Handles: Liga MX, Copa Libertadores, Liga Argentina,
//          LaLiga, Liga BetPlay Colombia, MLS
// Docs: https://www.api-football.com/documentation-v3
// ============================================================

import type {
  OddsEvent,
  Market,
  Outcome,
  OddsProvider,
  LeagueConfig,
} from "./types";
import { LEAGUE_CONFIG } from "./types";
import { fetchExternalJson } from "@/lib/net/external-read";

const BASE_URL = "https://v3.football.api-sports.io";

function getApiKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  return key;
}

interface ApiFootballFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string };
  };
  league: {
    id: number;
    name: string;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
}

interface ApiFootballOdds {
  fixture: { id: number };
  bookmakers: {
    name: string;
    bets: {
      id: number;
      name: string;
      values: { value: string; odd: string }[];
    }[];
  }[];
}

function parseDecimalOdds(odd: string): number {
  const n = parseFloat(odd);
  return isNaN(n) ? 1.0 : n;
}

function buildMarketsFromOdds(
  odds: ApiFootballOdds | undefined,
  homeTeam: string,
  awayTeam: string,
): Market[] {
  if (!odds?.bookmakers?.length) return [];

  // Prefer Bet365 bookmaker
  const bookmaker =
    odds.bookmakers.find((b) => b.name === "Bet365") ?? odds.bookmakers[0];
  if (!bookmaker) return [];

  const markets: Market[] = [];

  for (const bet of bookmaker.bets) {
    // Match Winner (1X2) → moneyline
    if (bet.id === 1) {
      const outcomes: Outcome[] = bet.values.map((v) => ({
        name:
          v.value === "Home"
            ? homeTeam
            : v.value === "Away"
              ? awayTeam
              : "Draw",
        odds: parseDecimalOdds(v.odd),
      }));
      markets.push({ type: "moneyline", key: "match_winner", outcomes });
    }
    // Goals Over/Under → total
    if (bet.id === 5) {
      const outcomes: Outcome[] = bet.values.map((v) => {
        const [side, line] = v.value.split(" ");
        return {
          name: side === "Over" ? "Over" : "Under",
          odds: parseDecimalOdds(v.odd),
          point: parseFloat(line ?? "2.5"),
        };
      });
      markets.push({ type: "total", key: "goals_over_under", outcomes });
    }
  }

  return markets;
}

async function fetchFixtures(
  leagueId: number,
  season: number,
): Promise<ApiFootballFixture[]> {
  const now = new Date();
  const from = now.toISOString().split("T")[0];
  const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const url = new URL(`${BASE_URL}/fixtures`);
  url.searchParams.set("league", String(leagueId));
  url.searchParams.set("season", String(season));
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);

  const { data } = await fetchExternalJson<{
    response: ApiFootballFixture[];
    errors: Record<string, string>;
  }>({
    provider: "api_football",
    operation: `fixtures:${leagueId}:${season}`,
    url,
    init: {
      headers: { "x-apisports-key": getApiKey() },
      next: { revalidate: 0 },
    },
    recordOps: true,
    validate: (payload) => {
      if (payload.errors && Object.keys(payload.errors).length > 0) {
        const combined = JSON.stringify(payload.errors);
        return {
          code: /plan|quota|limit/i.test(combined)
            ? "quota_exhausted"
            : "bad_response",
          message: combined,
        };
      }
      return null;
    },
  });

  return data.response ?? [];
}

async function fetchOdds(
  fixtureId: number,
): Promise<ApiFootballOdds | undefined> {
  const url = new URL(`${BASE_URL}/odds`);
  url.searchParams.set("fixture", String(fixtureId));

  const { data } = await fetchExternalJson<{ response: ApiFootballOdds[] }>({
    provider: "api_football",
    operation: `odds:${fixtureId}`,
    url,
    init: {
      headers: { "x-apisports-key": getApiKey() },
      next: { revalidate: 0 },
    },
    retries: 1,
    recordOps: true,
  }).catch(() => ({ data: { response: [] } }));
  return data.response?.[0];
}

export class ApiFootballProvider implements OddsProvider {
  name = "api_football";

  getSupportedLeagues(): LeagueConfig[] {
    return LEAGUE_CONFIG.filter((l) => l.provider === "api_football");
  }

  async getEvents(sport: string, league: string): Promise<OddsEvent[]> {
    const config = LEAGUE_CONFIG.find(
      (l) =>
        l.sport === sport &&
        l.league === league &&
        l.provider === "api_football",
    );
    if (!config?.providerLeagueId) return [];

    const season = config.season ?? new Date().getFullYear();
    const fixtures = await fetchFixtures(config.providerLeagueId, season);

    // Fetch odds in parallel (rate-limit: max 10 concurrent)
    const chunks = [];
    for (let i = 0; i < fixtures.length; i += 10) {
      chunks.push(fixtures.slice(i, i + 10));
    }

    const events: OddsEvent[] = [];

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (fixture): Promise<OddsEvent> => {
          const odds = await fetchOdds(fixture.fixture.id);
          const isLive =
            fixture.fixture.status.short === "1H" ||
            fixture.fixture.status.short === "2H" ||
            fixture.fixture.status.short === "HT";

          return {
            id: String(fixture.fixture.id),
            sport,
            league,
            leagueDisplay: config.leagueDisplay,
            homeTeam: fixture.teams.home.name,
            awayTeam: fixture.teams.away.name,
            startTime: new Date(fixture.fixture.date),
            isLive,
            markets: buildMarketsFromOdds(
              odds,
              fixture.teams.home.name,
              fixture.teams.away.name,
            ),
          };
        }),
      );
      events.push(...results);
    }

    return events;
  }
}
