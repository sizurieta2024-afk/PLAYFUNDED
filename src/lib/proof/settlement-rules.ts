export type SettleStatus = "won" | "lost" | "void" | "push";

export interface SettlementResult {
  status: SettleStatus;
  actualPayout: number;
}

export interface GameScores {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

export interface PickSettlementSnapshot {
  marketType: string;
  selection: string;
  linePoint: number | null;
  stake: number;
  potentialPayout: number;
}

export function gradeMoneyline(
  selection: string,
  scores: GameScores,
): SettleStatus {
  const { homeTeam, awayTeam, homeScore, awayScore } = scores;

  if (homeScore === awayScore) {
    return selection === "Draw" ? "won" : "push";
  }

  const winner = homeScore > awayScore ? homeTeam : awayTeam;
  if (selection === "Draw") return "lost";
  return selection === winner ? "won" : "lost";
}

export function gradeSpread(
  selection: string,
  linePoint: number,
  scores: GameScores,
): SettleStatus {
  const { homeTeam, homeScore, awayScore } = scores;
  const selectionScore = selection === homeTeam ? homeScore : awayScore;
  const opponentScore = selection === homeTeam ? awayScore : homeScore;
  const margin = selectionScore - opponentScore + linePoint;

  if (margin > 0) return "won";
  if (margin < 0) return "lost";
  return "push";
}

export function gradeTotal(
  selection: string,
  linePoint: number,
  scores: GameScores,
): SettleStatus {
  const total = scores.homeScore + scores.awayScore;

  if (selection === "Over") {
    if (total > linePoint) return "won";
    if (total < linePoint) return "lost";
    return "push";
  }

  if (selection === "Under") {
    if (total < linePoint) return "won";
    if (total > linePoint) return "lost";
    return "push";
  }

  return "void";
}

export function gradePick(
  pick: PickSettlementSnapshot,
  scores: GameScores,
): SettlementResult {
  let status: SettleStatus;

  if (pick.marketType === "moneyline") {
    status = gradeMoneyline(pick.selection, scores);
  } else if (pick.marketType === "spread") {
    status =
      pick.linePoint === null
        ? "void"
        : gradeSpread(pick.selection, pick.linePoint, scores);
  } else if (pick.marketType === "total") {
    status =
      pick.linePoint === null
        ? "void"
        : gradeTotal(pick.selection, pick.linePoint, scores);
  } else {
    status = "void";
  }

  return {
    status,
    actualPayout: status === "won" ? pick.potentialPayout : 0,
  };
}
