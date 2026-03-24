import type { Market, Outcome } from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function parseOutcome(value: unknown): Outcome | null {
  if (!isRecord(value) || typeof value.name !== "string") {
    return null;
  }

  const odds = toNumber(value.odds);
  if (odds === null) {
    return null;
  }

  const point = value.point === undefined ? undefined : toNumber(value.point);
  if (value.point !== undefined && point === null) {
    return null;
  }
  const normalizedPoint = point ?? undefined;

  return {
    name: value.name,
    odds,
    ...(normalizedPoint === undefined ? {} : { point: normalizedPoint }),
  };
}

export function parseMarkets(value: unknown): Market[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const markets: Market[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.type !== "string") {
      continue;
    }

    const outcomesValue = entry.outcomes;
    if (!Array.isArray(outcomesValue)) {
      continue;
    }

    const outcomes = outcomesValue
      .map((outcome) => parseOutcome(outcome))
      .filter((outcome): outcome is Outcome => outcome !== null);

    if (outcomes.length === 0) {
      continue;
    }

    markets.push({
      type: entry.type as Market["type"],
      key: typeof entry.key === "string" ? entry.key : entry.type,
      outcomes,
    });
  }

  return markets;
}

function samePoint(a: number | null, b: number | null): boolean {
  if (a === null || b === null) {
    return a === b;
  }

  return Math.abs(a - b) < 0.000001;
}

export function findMarketOutcome(
  markets: readonly Market[],
  marketType: string,
  selection: string,
  linePoint: number | null,
): Outcome | null {
  for (const market of markets) {
    if (market.type !== marketType) {
      continue;
    }

    const outcome = market.outcomes.find(
      (candidate) =>
        candidate.name === selection &&
        samePoint(candidate.point ?? null, linePoint),
    );

    if (outcome) {
      return outcome;
    }
  }

  return null;
}
