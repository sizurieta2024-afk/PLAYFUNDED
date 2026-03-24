const { parseArgs } = require("node:util");

const { prisma } = require("../src/lib/prisma.ts");
const { fetchApiFootballScores } = require("../src/lib/odds/scores.ts");
const { gradePick } = require("../src/lib/proof/settlement-rules.ts");
const { LEAGUE_CONFIG } = require("../src/lib/odds/types.ts");

const API_BASE_URL = "https://v3.football.api-sports.io";

const HELP = `Usage:
  npm run diag:api-football-settlement -- --fixture <fixtureId> [--pick-id <pickId>]
  npm run diag:api-football-settlement -- --fixture <fixtureId> --market-type <moneyline|spread|total> --selection <value> [--line-point <number>] [--stake <cents>] [--odds <decimal>] [--potential-payout <cents>]

Examples:
  npm run diag:api-football-settlement -- --fixture 1376807
  npm run diag:api-football-settlement -- --pick-id <pending-pick-id>
  npm run diag:api-football-settlement -- --fixture 1376807 --market-type moneyline --selection "Inter Miami" --stake 1000 --odds 2.15

Notes:
  - --pick-id loads the exact pick from the database and dry-runs grading against the live fixture result.
  - If you omit --pick-id, you can still simulate grading by passing market details manually.
  - Exit code 2 means the fixture exists but is not settlement-ready yet.`;

function printHelp() {
  console.log(HELP);
}

function parseIntegerOption(name, value) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid integer for --${name}: ${value}`);
  }
  return parsed;
}

function parseNumberOption(name, value) {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid number for --${name}: ${value}`);
  }
  return parsed;
}

function getLeagueConfigForPick(pick) {
  return (
    LEAGUE_CONFIG.find(
      (config) => config.sport === pick.sport && config.league === pick.league,
    ) ?? null
  );
}

async function fetchRawFixture(fixtureId) {
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error("API_FOOTBALL_KEY is not configured");
  }

  const url = new URL(`${API_BASE_URL}/fixtures`);
  url.searchParams.set("id", fixtureId);

  const res = await fetch(url.toString(), {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `API-Football fixture fetch failed (${fixtureId}): ${res.status} ${await res.text()}`,
    );
  }

  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error(
      `API-Football fixture fetch failed (${fixtureId}): ${JSON.stringify(data.errors)}`,
    );
  }

  return data.response?.[0] ?? null;
}

async function loadPick(pickId) {
  return prisma.pick.findUnique({
    where: { id: pickId },
    select: {
      id: true,
      event: true,
      eventName: true,
      sport: true,
      league: true,
      marketType: true,
      selection: true,
      linePoint: true,
      stake: true,
      odds: true,
      potentialPayout: true,
      status: true,
      settledAt: true,
      challengeId: true,
      userId: true,
    },
  });
}

function buildManualSnapshot(values) {
  const marketType = values["market-type"];
  const selection = values.selection;
  if (!marketType || !selection) {
    throw new Error(
      "Manual dry-run requires both --market-type and --selection",
    );
  }

  const stake = parseIntegerOption("stake", values.stake);
  const odds = parseNumberOption("odds", values.odds);
  const potentialPayout = parseIntegerOption(
    "potential-payout",
    values["potential-payout"],
  );
  const linePoint = parseNumberOption("line-point", values["line-point"]) ?? null;

  const resolvedPotentialPayout =
    potentialPayout ?? (stake !== undefined && odds !== undefined ? Math.round(stake * odds) : undefined);

  if (resolvedPotentialPayout === undefined) {
    throw new Error(
      "Manual dry-run requires --potential-payout or both --stake and --odds",
    );
  }

  return {
    marketType,
    selection,
    linePoint,
    stake: stake ?? 0,
    potentialPayout: resolvedPotentialPayout,
  };
}

function summarizeFixture(rawFixture, normalizedResult) {
  return {
    fixtureId: String(rawFixture.fixture.id),
    league: rawFixture.league
      ? { id: rawFixture.league.id, name: rawFixture.league.name }
      : null,
    status: rawFixture.fixture.status?.short ?? null,
    kickoff: rawFixture.fixture.date ?? null,
    homeTeam: rawFixture.teams?.home?.name ?? null,
    awayTeam: rawFixture.teams?.away?.name ?? null,
    goals: rawFixture.goals ?? null,
    fulltime: rawFixture.score?.fulltime ?? null,
    normalizedGameResult: normalizedResult ?? null,
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      fixture: { type: "string" },
      "pick-id": { type: "string" },
      "market-type": { type: "string" },
      selection: { type: "string" },
      "line-point": { type: "string" },
      stake: { type: "string" },
      odds: { type: "string" },
      "potential-payout": { type: "string" },
      json: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const pickId = values["pick-id"];
  let pick = null;
  if (pickId) {
    pick = await loadPick(pickId);
    if (!pick) {
      throw new Error(`Pick not found: ${pickId}`);
    }
  }

  const fixtureId = values.fixture ?? pick?.event;
  if (!fixtureId) {
    printHelp();
    throw new Error("Provide --fixture or --pick-id");
  }

  if (pick && values.fixture && pick.event !== values.fixture) {
    throw new Error(
      `Fixture mismatch: pick ${pick.id} belongs to event ${pick.event}, not ${values.fixture}`,
    );
  }

  const rawFixture = await fetchRawFixture(fixtureId);
  if (!rawFixture) {
    throw new Error(`Fixture not found: ${fixtureId}`);
  }

  const normalizedResult =
    (await fetchApiFootballScores([fixtureId])).find(
      (result) => result.eventId === String(fixtureId),
    ) ?? null;

  let dryRun = null;
  if (pick) {
    const leagueConfig = getLeagueConfigForPick(pick);
    if (leagueConfig?.provider !== "api_football") {
      throw new Error(
        `Pick ${pick.id} belongs to ${pick.league} (${leagueConfig?.provider ?? "unknown provider"}), not an API-Football league`,
      );
    }
    dryRun = {
      source: "database-pick",
      pick: {
        id: pick.id,
        challengeId: pick.challengeId,
        userId: pick.userId,
        event: pick.event,
        eventName: pick.eventName,
        sport: pick.sport,
        league: pick.league,
        provider: leagueConfig?.provider ?? null,
        marketType: pick.marketType,
        selection: pick.selection,
        linePoint: pick.linePoint,
        stake: pick.stake,
        odds: pick.odds,
        potentialPayout: pick.potentialPayout,
        status: pick.status,
        settledAt: pick.settledAt,
      },
      settlement:
        normalizedResult === null
          ? null
          : gradePick(
              {
                marketType: pick.marketType,
                selection: pick.selection,
                linePoint: pick.linePoint,
                stake: pick.stake,
                potentialPayout: pick.potentialPayout,
              },
              normalizedResult,
            ),
    };
  } else if (values["market-type"] || values.selection) {
    const snapshot = buildManualSnapshot(values);
    dryRun = {
      source: "manual-input",
      pick: snapshot,
      settlement: normalizedResult === null ? null : gradePick(snapshot, normalizedResult),
    };
  }

  const payload = {
    settlementReady: normalizedResult !== null,
    fixture: summarizeFixture(rawFixture, normalizedResult),
    dryRun,
  };

  if (values.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(JSON.stringify(payload, null, 2));
    if (normalizedResult === null) {
      console.error(
        `Fixture ${fixtureId} is not settlement-ready yet (status ${rawFixture.fixture.status?.short ?? "unknown"}).`,
      );
    }
  }

  if (normalizedResult === null) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(`FAIL ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
