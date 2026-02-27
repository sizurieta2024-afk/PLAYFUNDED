// ============================================================
// ODDS PROVIDER — shared types and interface
// All adapters must conform to this interface so providers
// can be swapped without touching any other code.
// ============================================================

export type MarketType = "moneyline" | "spread" | "total" | "player_prop";

export interface Outcome {
  name: string; // "Home", "Away", "Over", "Under", team name, player name
  odds: number; // Decimal odds (e.g. 2.50)
  point?: number; // Spread or total line (e.g. -3.5, 220.5)
}

export interface Market {
  type: MarketType;
  key: string; // raw market key from provider
  outcomes: Outcome[];
}

export interface OddsEvent {
  id: string; // Provider event ID
  sport: string; // e.g. "soccer", "basketball", "americanfootball"
  league: string; // e.g. "liga_mx", "nba", "epl"
  leagueDisplay: string; // e.g. "Liga MX", "NBA", "Premier League"
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  isLive: boolean;
  markets: Market[];
}

export interface OddsProvider {
  name: string;
  getEvents(sport: string, league: string): Promise<OddsEvent[]>;
  getSupportedLeagues(): LeagueConfig[];
}

export interface LeagueConfig {
  sport: string; // internal sport key
  league: string; // internal league key
  leagueDisplay: string;
  provider: "odds_api" | "api_football";
  providerKey: string; // the key used in the provider's API
  providerLeagueId?: number; // for API-Football league IDs
  season?: number; // API-Football season year (update when season rolls over)
}

// All leagues PlayFunded supports
export const LEAGUE_CONFIG: LeagueConfig[] = [
  // ── The Odds API ──────────────────────────────────────────
  {
    sport: "basketball",
    league: "nba",
    leagueDisplay: "NBA",
    provider: "odds_api",
    providerKey: "basketball_nba",
  },
  {
    sport: "americanfootball",
    league: "nfl",
    leagueDisplay: "NFL",
    provider: "odds_api",
    providerKey: "americanfootball_nfl",
  },
  {
    sport: "soccer",
    league: "epl",
    leagueDisplay: "Premier League",
    provider: "odds_api",
    providerKey: "soccer_epl",
  },
  {
    sport: "soccer",
    league: "serie_a",
    leagueDisplay: "Serie A",
    provider: "odds_api",
    providerKey: "soccer_italy_serie_a",
  },
  {
    sport: "soccer",
    league: "bundesliga",
    leagueDisplay: "Bundesliga",
    provider: "odds_api",
    providerKey: "soccer_germany_bundesliga",
  },
  {
    sport: "soccer",
    league: "ucl",
    leagueDisplay: "UEFA Champions League",
    provider: "odds_api",
    providerKey: "soccer_uefa_champs_league",
  },
  {
    sport: "mma",
    league: "ufc",
    leagueDisplay: "UFC",
    provider: "odds_api",
    providerKey: "mma_mixed_martial_arts",
  },
  {
    sport: "tennis",
    league: "atp",
    leagueDisplay: "Tennis ATP/WTA",
    provider: "odds_api",
    providerKey: "tennis_atp_french_open",
  },
  // ── API-Football ─────────────────────────────────────────
  // NOTE: season year ≠ calendar year for some leagues (Liga MX, LaLiga use
  // the year the season STARTED). Update these when seasons roll over.
  {
    sport: "soccer",
    league: "liga_mx",
    leagueDisplay: "Liga MX",
    provider: "api_football",
    providerKey: "liga_mx",
    providerLeagueId: 262,
    season: 2025, // Apertura/Clausura 2025-26
  },
  {
    sport: "soccer",
    league: "copa_libertadores",
    leagueDisplay: "Copa Libertadores",
    provider: "api_football",
    providerKey: "copa_libertadores",
    providerLeagueId: 13,
    season: 2026,
  },
  {
    sport: "soccer",
    league: "liga_argentina",
    leagueDisplay: "Liga Argentina",
    provider: "api_football",
    providerKey: "liga_argentina",
    providerLeagueId: 128,
    season: 2026,
  },
  {
    sport: "soccer",
    league: "laliga",
    leagueDisplay: "LaLiga",
    provider: "api_football",
    providerKey: "laliga",
    providerLeagueId: 140,
    season: 2025, // 2025-26 season
  },
  {
    sport: "soccer",
    league: "liga_betplay",
    leagueDisplay: "Liga BetPlay",
    provider: "api_football",
    providerKey: "liga_betplay",
    providerLeagueId: 239,
    season: 2026,
  },
  {
    sport: "soccer",
    league: "mls",
    leagueDisplay: "MLS",
    provider: "api_football",
    providerKey: "mls",
    providerLeagueId: 253,
    season: 2026,
  },
];
