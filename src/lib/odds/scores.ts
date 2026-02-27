// ============================================================
// SCORES — fetch completed game results from The Odds API
// Used by the settlement cron to auto-grade picks
// Only covers Odds API sports (not API-Football)
// ============================================================

const BASE_URL = "https://api.the-odds-api.com/v4";

function getApiKey(): string {
  const key = process.env.ODDS_API_KEY;
  if (!key) throw new Error("ODDS_API_KEY not set");
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

export async function fetchScores(
  sportKey: string,
  daysFrom = 3,
): Promise<GameResult[]> {
  const url = new URL(`${BASE_URL}/sports/${sportKey}/scores`);
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
