// ============================================================
// SCORES — fetch completed game results from both odds providers
// Used by the settlement cron to auto-grade picks.
// The Odds API is used for most sports. API-Football covers the
// soccer leagues that are quoted through API-Sports.
// ============================================================

import { fetchWithTimeout } from "../net/fetch-with-timeout";

const ODDS_API_BASE_URL = "https://api.the-odds-api.com/v4";
const API_FOOTBALL_BASE_URL = "https://v3.football.api-sports.io";
const API_FOOTBALL_FINAL_STATUSES = new Set(["FT", "AET", "PEN"]);

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY not set");
  return key;
}

function getApiFootballKey(): string {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  return key;
}

export interface GameResult {
  eventId: string;
  sportKey: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  completed: boolean;
}

interface OddsApiScoreEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  completed: boolean;
  scores: { name: string; score: string }[] | null;
}

interface ApiFootballScoreFixture {
  fixture: {
    id: number;
    status: { short: string };
  };
  teams: {
    home: { name: string };
    away: { name: string };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score?: {
    fulltime?: {
      home: number | null;
      away: number | null;
    } | null;
  } | null;
}

function mapApiFootballFixtureToGameResult(
  fixture: ApiFootballScoreFixture,
): GameResult | null {
  const status = fixture.fixture.status.short;
  if (!API_FOOTBALL_FINAL_STATUSES.has(status)) {
    return null;
  }

  // API-Football can expose extra-time / penalties in `goals`.
  // For standard 1X2 and totals settlement we want regulation/full-time
  // whenever it is available.
  const regulationHome = fixture.score?.fulltime?.home;
  const regulationAway = fixture.score?.fulltime?.away;
  const hasFullTimeScore = regulationHome != null && regulationAway != null;

  const homeScore =
    hasFullTimeScore
      ? regulationHome
      : status === "FT"
        ? fixture.goals.home
        : null;
  const awayScore =
    hasFullTimeScore
      ? regulationAway
      : status === "FT"
        ? fixture.goals.away
        : null;

  if (homeScore === null || awayScore === null) {
    return null;
  }

  return {
    eventId: String(fixture.fixture.id),
    sportKey: "api_football",
    homeTeam: fixture.teams.home.name,
    awayTeam: fixture.teams.away.name,
    homeScore,
    awayScore,
    completed: true,
  };
}

export async function fetchOddsApiScores(
  sportKey: string,
  daysFrom = 3,
): Promise<GameResult[]> {
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/scores`);
  url.searchParams.set("apiKey", getApiKey());
  url.searchParams.set("daysFrom", String(daysFrom));
  url.searchParams.set("dateFormat", "iso");

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OddsAPI scores error (${sportKey}): ${res.status} ${err}`);
  }

  const data = (await res.json()) as OddsApiScoreEvent[];

  return data
    .filter((e) => e.completed && e.scores && e.scores.length >= 2)
    .map((e): GameResult | null => {
      const homeEntry = e.scores?.find((s) => s.name === e.home_team);
      const awayEntry = e.scores?.find((s) => s.name === e.away_team);
      if (!homeEntry || !awayEntry) return null;

      const homeScore = parseFloat(homeEntry.score);
      const awayScore = parseFloat(awayEntry.score);
      if (isNaN(homeScore) || isNaN(awayScore)) return null;

      return {
        eventId: e.id,
        sportKey: e.sport_key,
        homeTeam: e.home_team,
        awayTeam: e.away_team,
        homeScore,
        awayScore,
        completed: true,
      };
    })
    .filter((r): r is GameResult => r !== null);
}

async function fetchApiFootballFixtureScore(
  eventId: string,
): Promise<GameResult | null> {
  const url = new URL(`${API_FOOTBALL_BASE_URL}/fixtures`);
  url.searchParams.set("id", eventId);

  const res = await fetchWithTimeout(
    url.toString(),
    {
      headers: { "x-apisports-key": getApiFootballKey() },
      cache: "no-store",
    },
    10_000,
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API-Football scores error (${eventId}): ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    response?: ApiFootballScoreFixture[];
    errors?: Record<string, string>;
  };

  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(
      `API-Football scores error (${eventId}): ${JSON.stringify(data.errors)}`,
    );
  }

  const fixture = data.response?.[0];
  return fixture ? mapApiFootballFixtureToGameResult(fixture) : null;
}

export async function fetchApiFootballScores(
  eventIds: Iterable<string>,
): Promise<GameResult[]> {
  const uniqueEventIds = Array.from(new Set(eventIds)).filter(Boolean);
  const results: GameResult[] = [];

  for (let index = 0; index < uniqueEventIds.length; index += 10) {
    const chunk = uniqueEventIds.slice(index, index + 10);
    const settledChunk = await Promise.allSettled(
      chunk.map((eventId) => fetchApiFootballFixtureScore(eventId)),
    );

    for (const [indexInChunk, outcome] of settledChunk.entries()) {
      if (outcome.status === "fulfilled") {
        if (outcome.value) {
          results.push(outcome.value);
        }
        continue;
      }

      console.error(
        `[api-football/scores] Failed to fetch fixture ${chunk[indexInChunk]}:`,
        outcome.reason,
      );
    }
  }

  return results;
}

export const fetchScores = fetchOddsApiScores;
