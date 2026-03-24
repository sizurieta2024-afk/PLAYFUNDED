"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, X, Zap } from "lucide-react";
import { EVENT_LOCK_MINUTES } from "@/lib/challenge/event-lock";
import { PLATFORM_POLICY } from "@/lib/platform-policy";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Outcome {
  name: string;
  odds: number;
  point?: number;
}

interface Market {
  type: string;
  key: string;
  outcomes: Outcome[];
}

interface CachedEvent {
  id: string;
  event: string;
  sport: string;
  league: string;
  eventName: string | null;
  startTime: string;
  isLive: boolean;
  markets: Market[];
}

interface PickRecord {
  id: string;
  sport: string;
  league: string;
  eventName: string | null;
  marketType: string;
  selection: string;
  odds: number;
  stake: number;
  potentialPayout: number;
  status: string;
  placedAt: string;
}

interface ChallengeData {
  id: string;
  balance: number;
  startBalance: number;
  phase: string;
  status: string;
  phase1StartBalance: number | null;
  phase2StartBalance: number | null;
  tier: {
    name: string;
    profitSplitPct: number;
    minPicks: number;
  };
}

interface SlipLeg {
  event: CachedEvent;
  marketType: string;
  market: Market;
  outcome: Outcome;
}

interface Props {
  challenge: ChallengeData;
  initialPicks: PickRecord[];
  t: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getProfitTargetCents(challenge: ChallengeData): number {
  if (challenge.phase === "phase1") {
    const base = challenge.phase1StartBalance ?? challenge.startBalance;
    return base + Math.floor((base * 20) / 100);
  }
  if (challenge.phase === "phase2") {
    const base = challenge.phase2StartBalance ?? challenge.startBalance;
    return base + Math.floor((base * 20) / 100);
  }
  return Infinity;
}

function getPhaseLabel(phase: string, t: Record<string, string>): string {
  if (phase === "phase1") return t.phase1;
  if (phase === "phase2") return t.phase2;
  return t.funded;
}

function isEventStillOpen(event: CachedEvent): boolean {
  if (event.isLive) return false;
  const eventStart = new Date(event.startTime).getTime();
  if (Number.isNaN(eventStart)) return false;
  return eventStart > Date.now() + EVENT_LOCK_MINUTES * 60 * 1000;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-500",
  won: "bg-pf-brand/15 text-pf-brand",
  lost: "bg-red-500/15 text-red-400",
  void: "bg-muted text-muted-foreground",
  push: "bg-muted text-muted-foreground",
};

const SPORT_TABS = [
  { key: "all", label: "All", icon: "🌐" },
  { key: "soccer", label: "Soccer", icon: "⚽" },
  { key: "basketball", label: "Basketball", icon: "🏀" },
  { key: "americanfootball", label: "Football", icon: "🏈" },
  { key: "mma", label: "MMA", icon: "🥊" },
  { key: "tennis", label: "Tennis", icon: "🎾" },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export function PicksClient({ challenge, initialPicks, t }: Props) {
  const router = useRouter();
  const [picks, setPicks] = useState<PickRecord[]>(initialPicks);
  const [balance, setBalance] = useState(challenge.balance);

  const [events, setEvents] = useState<CachedEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [activeSport, setActiveSport] = useState<string>("all");
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // Unified bet slip — 1 leg = single, 2-4 legs = parlay
  const [legs, setLegs] = useState<SlipLeg[]>([]);
  const [stakeInput, setStakeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState(false);
  const [eventsTick, setEventsTick] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      if (!cancelled) setLoadingEvents(true);
      try {
        const res = await fetch("/api/odds/events");
        if (res.ok) {
          const data = (await res.json()) as { events: CachedEvent[] };
          if (!cancelled) setEvents(data.events.filter(isEventStillOpen));
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) {
          setLoadingEvents(false);
          setEventsTick(Date.now());
        }
      }
    }

    void fetchEvents();
    const timer = setInterval(() => void fetchEvents(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setEventsTick(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshPicks() {
      try {
        const res = await fetch(`/api/picks?challengeId=${challenge.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { picks?: PickRecord[] };
        if (!cancelled && Array.isArray(data.picks)) setPicks(data.picks);
      } catch {
        // silent
      }
    }

    void refreshPicks();
    const timer = setInterval(() => void refreshPicks(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [challenge.id]);

  // Remove legs whose events have locked since the user added them
  useEffect(() => {
    setLegs((prev) => {
      const open = prev.filter((leg) => isEventStillOpen(leg.event));
      if (open.length < prev.length) {
        setSubmitError(
          "One or more events have been removed because they are now locked.",
        );
      }
      return open;
    });
  }, [eventsTick]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const maxStakeCents = Math.floor((challenge.startBalance * 5) / 100);
  const minStakeCents = Math.max(
    100,
    Math.floor((challenge.startBalance * 1) / 100),
  );
  const targetCents = getProfitTargetCents(challenge);
  const pendingStakeCents = picks
    .filter((p) => p.status === "pending")
    .reduce((sum, p) => sum + p.stake, 0);
  const effectiveBalance = balance + pendingStakeCents;
  const progressPct =
    targetCents === Infinity
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((effectiveBalance - challenge.startBalance) /
                (targetCents - challenge.startBalance)) *
                100,
            ),
          ),
        );

  const availableSports = Array.from(new Set(events.map((e) => e.sport)));
  const visibleSportTabs = SPORT_TABS.filter(
    (tab) => tab.key === "all" || availableSports.includes(tab.key),
  );
  const openEvents = events.filter(isEventStillOpen);
  const filteredEvents =
    activeSport === "all"
      ? openEvents
      : openEvents.filter((e) => e.sport === activeSport);

  const eventsByLeague = filteredEvents.reduce<Record<string, CachedEvent[]>>(
    (acc, event) => {
      const key = event.league;
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    },
    {},
  );

  const stakeNum = parseFloat(stakeInput);
  const stakeCents =
    Number.isFinite(stakeNum) && stakeNum > 0 ? Math.round(stakeNum * 100) : 0;

  const isParlay = legs.length >= 2;
  const combinedOdds = legs.reduce((p, leg) => p * leg.outcome.odds, 1);
  const effectiveOdds = isParlay ? combinedOdds : (legs[0]?.outcome.odds ?? 1);
  const potentialPayoutCents =
    legs.length > 0 && stakeCents > 0
      ? Math.round(stakeCents * effectiveOdds)
      : 0;

  const stakeError =
    stakeCents > 0 && stakeCents > maxStakeCents
      ? (t.stakeOverMax ?? "Max {max}").replace(
          "{max}",
          formatCents(maxStakeCents),
        )
      : stakeCents > 0 && stakeCents < minStakeCents
        ? (t.stakeBelowMin ?? "Min {min}").replace(
            "{min}",
            formatCents(minStakeCents),
          )
        : null;
  const stakeOverMax = stakeCents > 0 && stakeCents > maxStakeCents;

  // ── Slip toggle — click to add, click again to remove ────────────────────

  function toggleLeg(event: CachedEvent, market: Market, outcome: Outcome) {
    setSubmitError(null);

    // Already in slip → remove it
    const existingIdx = legs.findIndex(
      (l) =>
        l.event.event === event.event &&
        l.market.key === market.key &&
        l.outcome.name === outcome.name,
    );
    if (existingIdx !== -1) {
      setLegs((prev) => prev.filter((_, i) => i !== existingIdx));
      return;
    }

    // Different outcome from same game already in slip → replace it
    const sameGameIdx = legs.findIndex((l) => l.event.event === event.event);
    if (sameGameIdx !== -1) {
      setLegs((prev) =>
        prev.map((l, i) =>
          i === sameGameIdx
            ? { event, marketType: market.type, market, outcome }
            : l,
        ),
      );
      return;
    }

    // Max legs per parlay
    if (legs.length >= PLATFORM_POLICY.trading.maxParlayLegs) {
      setSubmitError(t.parlayMaxLegs);
      return;
    }

    setLegs((prev) => [
      ...prev,
      { event, marketType: market.type, market, outcome },
    ]);
    if (!stakeInput) setStakeInput("");
  }

  function removeLeg(idx: number) {
    setLegs((prev) => prev.filter((_, i) => i !== idx));
    setSubmitError(null);
  }

  function clearSlip() {
    setLegs([]);
    setStakeInput("");
    setSubmitError(null);
  }

  function isInSlip(eventId: string, marketKey: string, outcomeName: string) {
    return legs.some(
      (l) =>
        l.event.event === eventId &&
        l.market.key === marketKey &&
        l.outcome.name === outcomeName,
    );
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (
      legs.length === 0 ||
      stakeCents < minStakeCents ||
      stakeCents > maxStakeCents
    )
      return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      let res: Response;

      if (legs.length === 1) {
        // Single pick
        const leg = legs[0];
        res = await fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.id,
            sport: leg.event.sport,
            league: leg.event.league,
            event: leg.event.event,
            eventName: leg.event.eventName,
            marketType: leg.marketType,
            selection: leg.outcome.name,
            odds: leg.outcome.odds,
            linePoint: leg.outcome.point ?? null,
            stake: stakeCents,
          }),
        });
      } else {
        // Parlay
        res = await fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.id,
            stake: stakeCents,
            isParlay: true,
            legs: legs.map((leg) => ({
              sport: leg.event.sport,
              league: leg.event.league,
              event: leg.event.event,
              eventName: leg.event.eventName,
              marketType: leg.marketType,
              selection: leg.outcome.name,
              odds: leg.outcome.odds,
              linePoint: leg.outcome.point ?? null,
            })),
          }),
        });
      }

      const data = (await res.json()) as {
        pick?: PickRecord;
        newBalance?: number;
        error?: string;
      };

      if (!res.ok) {
        setSubmitError(data.error ?? "Failed to place pick");
        return;
      }

      if (data.pick) setPicks((prev) => [data.pick!, ...prev]);
      if (data.newBalance !== undefined) setBalance(data.newBalance);
      clearSlip();
      setJustPlaced(true);
      setTimeout(() => setJustPlaced(false), 3000);
      router.refresh();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [legs, stakeCents, minStakeCents, maxStakeCents, challenge.id, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Challenge Stats Bar ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="h-1 w-full bg-muted">
          <motion.div
            className="h-full bg-pf-brand rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>
        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.balance}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {formatCents(balance)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.phase}</p>
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-pf-brand/15 text-pf-brand text-xs font-semibold">
                {getPhaseLabel(challenge.phase, t)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {challenge.tier.name}
            </p>
          </div>
          {targetCents !== Infinity && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t.target}</p>
              <p className="text-base font-semibold tabular-nums">
                {formatCents(targetCents)}
              </p>
              <p className="text-xs text-pf-brand mt-1">
                {progressPct}% {t.progress}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.maxStake}</p>
            <p className="text-base font-semibold tabular-nums">
              {formatCents(maxStakeCents)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {picks.filter((p) => p.status === "pending").length}{" "}
              {t.pending.toLowerCase()}
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── Pick placed success banner ─────────────────────────────────────── */}
      <AnimatePresence>
        {justPlaced && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-pf-brand/30 bg-pf-brand/10 text-pf-brand px-4 py-3 text-sm font-medium flex items-center gap-2"
          >
            <Zap className="w-4 h-4 shrink-0" />
            {isParlay ? t.parlayPlaced : t.pickPlaced}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main 2-col layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left col: Event Browser ───────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Sport tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {visibleSportTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSport(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeSport === tab.key
                    ? "bg-pf-pink text-white shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-pf-pink/40"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Events */}
          {loadingEvents ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 rounded-xl bg-card border border-border animate-pulse"
                />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center space-y-2">
              <p className="text-muted-foreground text-sm">{t.noEvents}</p>
              <p className="text-muted-foreground/60 text-xs">
                {t.noEventsHint}
              </p>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              {Object.entries(eventsByLeague).map(([league, leagueEvents]) => (
                <div key={league}>
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {league}
                    </span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                  <div className="space-y-1.5">
                    {leagueEvents.map((event) => (
                      <EventRow
                        key={event.id}
                        event={event}
                        isExpanded={expandedEvent === event.id}
                        onToggle={() =>
                          setExpandedEvent(
                            expandedEvent === event.id ? null : event.id,
                          )
                        }
                        onSelectOutcome={(outcome, market) =>
                          toggleLeg(event, market, outcome)
                        }
                        isInSlip={isInSlip}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Right col: Unified Bet Slip + Recent Picks ────────────────── */}
        <div className="space-y-4">
          {/* Bet Slip */}
          <AnimatePresence mode="wait">
            {legs.length > 0 ? (
              <motion.div
                key="betslip"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={`rounded-xl border bg-card overflow-hidden ${
                  isParlay ? "border-pf-pink/50" : "border-pf-brand/50"
                }`}
              >
                {/* Slip header */}
                <div
                  className={`flex items-center justify-between px-4 py-3 border-b ${
                    isParlay
                      ? "bg-pf-pink/10 border-pf-pink/20"
                      : "bg-pf-brand/10 border-pf-brand/20"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold uppercase tracking-wide ${
                        isParlay ? "text-pf-pink" : "text-pf-brand"
                      }`}
                    >
                      {isParlay ? `${t.parlay} (${legs.length})` : "Bet Slip"}
                    </span>
                    {isParlay && (
                      <span className="text-xs text-muted-foreground">
                        ×{combinedOdds.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={clearSlip}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {/* Legs list */}
                  <div className="space-y-2">
                    {legs.map((leg, idx) => (
                      <div
                        key={`${leg.event.event}-${leg.market.key}-${leg.outcome.name}`}
                        className="flex items-start justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-snug">
                            {leg.outcome.name}
                            {leg.outcome.point !== undefined
                              ? ` ${leg.outcome.point > 0 ? "+" : ""}${leg.outcome.point}`
                              : ""}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {leg.event.eventName ?? leg.event.event}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-muted-foreground">
                              {leg.marketType === "moneyline"
                                ? t.moneyline
                                : leg.marketType === "spread"
                                  ? t.spread
                                  : t.total}
                            </span>
                            <span
                              className={`text-sm font-bold tabular-nums ${
                                isParlay ? "text-pf-pink" : "text-pf-brand"
                              }`}
                            >
                              {leg.outcome.odds.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeLeg(idx)}
                          className="text-muted-foreground hover:text-foreground transition-colors mt-0.5 shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Max legs inline warning */}
                  {legs.length === PLATFORM_POLICY.trading.maxParlayLegs && (
                    <div className="flex gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                      <span className="shrink-0 mt-0.5">⚠</span>
                      <p className="leading-relaxed">
                        {t.parlayMaxLegsWarning ??
                          "You've reached the 4-leg limit. This rule is designed to help you manage risk and build consistent trading habits."}
                      </p>
                    </div>
                  )}

                  {/* Divider + combined odds for parlay */}
                  {isParlay && (
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground">
                        {t.combinedOdds}
                      </span>
                      <span className="text-lg font-bold tabular-nums text-pf-pink">
                        {combinedOdds.toFixed(2)}
                      </span>
                    </div>
                  )}

                  {/* Stake input */}
                  <div className="space-y-1.5 pt-1 border-t border-border">
                    <label
                      className="text-xs font-medium text-muted-foreground"
                      htmlFor="stake-input"
                    >
                      {t.stakeLabel}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                        $
                      </span>
                      <input
                        id="stake-input"
                        type="number"
                        min={(minStakeCents / 100).toFixed(2)}
                        step="0.01"
                        value={stakeInput}
                        onChange={(e) => {
                          setStakeInput(e.target.value);
                          setSubmitError(null);
                        }}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-pf-pink/40 transition-shadow"
                      />
                    </div>
                    {stakeError ? (
                      <div
                        className={`flex gap-1.5 rounded-lg px-3 py-2 text-xs ${stakeOverMax ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-destructive/10 text-destructive"}`}
                      >
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <p className="leading-relaxed">{stakeError}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t.stakeHint.replace(
                          "{max}",
                          formatCents(maxStakeCents),
                        )}
                      </p>
                    )}
                  </div>

                  {/* Payout preview */}
                  <AnimatePresence>
                    {potentialPayoutCents > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex justify-between items-center py-2 border-t border-border"
                      >
                        <span className="text-sm text-muted-foreground">
                          {t.potentialPayout}
                        </span>
                        <span className="font-bold text-pf-brand tabular-nums">
                          {formatCents(potentialPayoutCents)}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {submitError && (
                    <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                      {submitError}
                    </p>
                  )}

                  <button
                    onClick={() => void handleSubmit()}
                    disabled={
                      isSubmitting ||
                      !!stakeError ||
                      stakeCents < minStakeCents ||
                      legs.length === 0
                    }
                    className="w-full py-3 rounded-lg bg-pf-pink text-white text-sm font-semibold disabled:opacity-50 hover:bg-pf-pink-dark transition-colors"
                  >
                    {isSubmitting
                      ? t.placing
                      : isParlay
                        ? t.confirmParlay
                        : t.confirmPick}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty-slip"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center"
              >
                <p className="text-sm text-muted-foreground">
                  {t.selectOutcome}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Current Bets (pending) */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {t.currentBets}
            </h2>
            {picks.filter((p) => p.status === "pending").length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">
                {t.noPendingBets}
              </p>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {picks
                  .filter((p) => p.status === "pending")
                  .map((pick, i, arr) => (
                    <motion.div
                      key={pick.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                      className={`flex items-center justify-between px-4 py-3 gap-3 ${
                        i < arr.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {pick.selection}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {pick.eventName ?? pick.league} ·{" "}
                          <span className="tabular-nums">
                            {pick.odds.toFixed(2)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_STYLES[pick.status] ??
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t[pick.status] ?? pick.status}
                        </span>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatCents(pick.stake)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
              </div>
            )}
          </div>

          {/* Past Bets (settled) */}
          {picks.filter((p) => p.status !== "pending").length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                {t.pastBets}
              </h2>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {picks
                  .filter((p) => p.status !== "pending")
                  .slice(0, 10)
                  .map((pick, i, arr) => (
                    <motion.div
                      key={pick.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.2 }}
                      className={`flex items-center justify-between px-4 py-3 gap-3 ${
                        i < arr.length - 1 ? "border-b border-border" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {pick.selection}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {pick.eventName ?? pick.league} ·{" "}
                          <span className="tabular-nums">
                            {pick.odds.toFixed(2)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right shrink-0 space-y-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_STYLES[pick.status] ??
                            "bg-muted text-muted-foreground"
                          }`}
                        >
                          {t[pick.status] ?? pick.status}
                        </span>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatCents(pick.stake)}
                        </p>
                      </div>
                    </motion.div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({
  event,
  isExpanded,
  onToggle,
  onSelectOutcome,
  isInSlip,
  t,
}: {
  event: CachedEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectOutcome: (outcome: Outcome, market: Market) => void;
  isInSlip: (
    eventId: string,
    marketKey: string,
    outcomeName: string,
  ) => boolean;
  t: Record<string, string>;
}) {
  const startDate = new Date(event.startTime);
  const timeStr = startDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const topMarket =
    event.markets.find((m) => m.type === "moneyline") ?? event.markets[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 transition-colors">
      {/* Top row */}
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Time */}
        <div className="text-center shrink-0 w-10">
          {event.isLive ? (
            <span className="text-red-500 text-xs font-bold animate-pulse">
              LIVE
            </span>
          ) : (
            <>
              <p className="text-xs font-semibold tabular-nums">{timeStr}</p>
              <p className="text-xs text-muted-foreground">{dateStr}</p>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate leading-tight">
            {event.eventName ?? event.id}
          </p>
          {event.markets.length > 1 && (
            <p className="text-xs text-muted-foreground">
              +{event.markets.length - 1} more markets
            </p>
          )}
        </div>

        {/* Inline moneyline odds */}
        {topMarket && (
          <div className="flex gap-1 shrink-0">
            {topMarket.outcomes.slice(0, 3).map((outcome) => {
              const active = isInSlip(event.event, topMarket.key, outcome.name);
              return (
                <button
                  key={outcome.name}
                  onClick={() => onSelectOutcome(outcome, topMarket)}
                  className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-xs transition-colors min-w-[52px] ${
                    active
                      ? "bg-pf-pink text-white font-semibold"
                      : "bg-secondary hover:bg-pf-pink/10 hover:text-pf-pink border border-border"
                  }`}
                >
                  <span className="truncate max-w-[48px] text-center leading-tight">
                    {outcome.name.length > 6
                      ? outcome.name.slice(0, 6) + "…"
                      : outcome.name}
                  </span>
                  <span className="font-bold mt-0.5 tabular-nums">
                    {outcome.odds.toFixed(2)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Expand toggle */}
        {event.markets.length > 1 && (
          <button
            onClick={onToggle}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Expanded markets */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border divide-y divide-border">
              {event.markets.map((market) => (
                <div key={market.key} className="px-3 py-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    {market.type === "moneyline"
                      ? t.moneyline
                      : market.type === "spread"
                        ? t.spread
                        : t.total}
                  </p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {market.outcomes.map((outcome) => {
                      const active = isInSlip(
                        event.event,
                        market.key,
                        outcome.name,
                      );
                      return (
                        <button
                          key={outcome.name}
                          onClick={() => onSelectOutcome(outcome, market)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                            active
                              ? "border-pf-pink bg-pf-pink/10 text-pf-pink font-semibold"
                              : "border-border hover:border-pf-pink/40 hover:bg-muted/60"
                          }`}
                        >
                          <span className="truncate max-w-full text-center leading-tight">
                            {outcome.name}
                            {outcome.point !== undefined
                              ? ` ${outcome.point > 0 ? "+" : ""}${outcome.point}`
                              : ""}
                          </span>
                          <span className="font-bold mt-0.5 tabular-nums">
                            {outcome.odds.toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
