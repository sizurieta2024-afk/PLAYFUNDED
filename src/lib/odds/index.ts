// ============================================================
// ODDS — unified entry point
// Routes requests to the correct provider by league config
// ============================================================

export { OddsApiProvider } from "./odds-api";
export { ApiFootballProvider } from "./api-football";
export { LEAGUE_CONFIG } from "./types";
export type { OddsEvent, Market, Outcome, OddsProvider, LeagueConfig, MarketType } from "./types";
