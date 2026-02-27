"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, X, Zap } from "lucide-react";

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

interface SelectedOutcome {
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
    return base + Math.floor((base * 10) / 100);
  }
  return Infinity;
}

function getPhaseLabel(phase: string, t: Record<string, string>): string {
  if (phase === "phase1") return t.phase1;
  if (phase === "phase2") return t.phase2;
  return t.funded;
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

  const [selected, setSelected] = useState<SelectedOutcome | null>(null);
  const [stakeInput, setStakeInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justPlaced, setJustPlaced] = useState(false);

  useEffect(() => {
    async function fetchEvents() {
      setLoadingEvents(true);
      try {
        const res = await fetch("/api/odds/events");
        if (res.ok) {
          const data = (await res.json()) as { events: CachedEvent[] };
          setEvents(data.events);
        }
      } catch {
        // silent
      } finally {
        setLoadingEvents(false);
      }
    }
    void fetchEvents();
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────

  const maxStakeCents = Math.floor((balance * 5) / 100);
  const targetCents = getProfitTargetCents(challenge);
  const progressPct =
    targetCents === Infinity
      ? 100
      : Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((balance - challenge.startBalance) /
                (targetCents - challenge.startBalance)) *
                100,
            ),
          ),
        );

  const availableSports = Array.from(new Set(events.map((e) => e.sport)));
  const visibleSportTabs = SPORT_TABS.filter(
    (tab) => tab.key === "all" || availableSports.includes(tab.key),
  );
  const filteredEvents =
    activeSport === "all"
      ? events
      : events.filter((e) => e.sport === activeSport);

  // Group events by league
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
  const potentialPayoutCents =
    selected && stakeCents > 0
      ? Math.round(stakeCents * selected.outcome.odds)
      : 0;
  const stakeError =
    stakeCents > 0 && stakeCents > maxStakeCents
      ? `Max ${formatCents(maxStakeCents)}`
      : stakeCents > 0 && stakeCents < 100
        ? "Min $1.00"
        : null;

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!selected || stakeCents < 100 || stakeCents > maxStakeCents) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: challenge.id,
          sport: selected.event.sport,
          league: selected.event.league,
          event: selected.event.id,
          eventName: selected.event.eventName,
          marketType: selected.marketType,
          selection: selected.outcome.name,
          odds: selected.outcome.odds,
          linePoint: selected.outcome.point ?? null,
          stake: stakeCents,
          eventStart: selected.event.startTime,
        }),
      });

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
      setSelected(null);
      setStakeInput("");
      setJustPlaced(true);
      setTimeout(() => setJustPlaced(false), 3000);
      router.refresh();
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selected, stakeCents, maxStakeCents, challenge.id, router]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── FTMO-style Challenge Stats Bar ───────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        {/* Phase indicator strip */}
        <div className="h-1 w-full bg-muted">
          <motion.div
            className="h-full bg-pf-brand rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          />
        </div>

        <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-5">
          {/* Balance */}
          <div>
            <p className="text-xs text-muted-foreground mb-1">{t.balance}</p>
            <p className="text-2xl font-bold tabular-nums tracking-tight">
              {formatCents(balance)}
            </p>
          </div>

          {/* Phase */}
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

          {/* Target */}
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

          {/* Max stake */}
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

      {/* ── Pick placed success banner ─────────────────────────────────── */}
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
            {t.pickPlaced}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main 2-col layout: event browser + bet slip ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left col: Event Browser (2/3) ─────────────────────────────── */}
        <div className="lg:col-span-2 space-y-3">
          {/* Sport tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {visibleSportTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveSport(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeSport === tab.key
                    ? "bg-pf-brand text-white shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-pf-brand/40"
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
                  {/* League header */}
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
                        onSelectOutcome={(outcome, market) => {
                          setSelected({
                            event,
                            marketType: market.type,
                            market,
                            outcome,
                          });
                          setStakeInput("");
                          setSubmitError(null);
                        }}
                        selected={selected}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        {/* ── Right col: Bet Slip + Recent Picks (1/3) ─────────────────── */}
        <div className="space-y-4">
          {/* Bet Slip */}
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key="betslip"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border border-pf-brand/50 bg-card overflow-hidden"
              >
                {/* Slip header */}
                <div className="flex items-center justify-between px-4 py-3 bg-pf-brand/10 border-b border-pf-brand/20">
                  <span className="text-xs font-semibold text-pf-brand uppercase tracking-wide">
                    Bet Slip
                  </span>
                  <button
                    onClick={() => {
                      setSelected(null);
                      setStakeInput("");
                      setSubmitError(null);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  {/* Selected outcome */}
                  <div>
                    <p className="font-semibold text-sm leading-snug">
                      {selected.outcome.name}
                      {selected.outcome.point !== undefined
                        ? ` ${selected.outcome.point > 0 ? "+" : ""}${selected.outcome.point}`
                        : ""}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {selected.event.eventName ?? selected.event.id}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">
                        {selected.marketType === "moneyline"
                          ? t.moneyline
                          : selected.marketType === "spread"
                            ? t.spread
                            : t.total}
                      </span>
                      <span className="text-xl font-bold tabular-nums text-pf-brand">
                        {selected.outcome.odds.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Stake input */}
                  <div className="space-y-1.5">
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
                        min="1"
                        step="0.01"
                        value={stakeInput}
                        onChange={(e) => {
                          setStakeInput(e.target.value);
                          setSubmitError(null);
                        }}
                        placeholder="0.00"
                        className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-pf-brand/40 transition-shadow"
                      />
                    </div>
                    {stakeError ? (
                      <p className="text-xs text-destructive">{stakeError}</p>
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
                        className="flex justify-between items-center py-3 border-t border-border"
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
                    disabled={isSubmitting || !!stakeError || stakeCents < 100}
                    className="w-full py-3 rounded-lg bg-pf-brand text-white text-sm font-semibold disabled:opacity-50 hover:bg-pf-brand-dark transition-colors"
                  >
                    {isSubmitting ? t.placing : t.confirmPick}
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

          {/* Recent Picks */}
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {t.recentPicks}
            </h2>
            {picks.length === 0 ? (
              <p className="text-sm text-muted-foreground px-1">{t.noPicks}</p>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {picks.slice(0, 10).map((pick, i) => (
                  <motion.div
                    key={pick.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    className={`flex items-center justify-between px-4 py-3 gap-3 ${
                      i < Math.min(picks.length, 10) - 1
                        ? "border-b border-border"
                        : ""
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
  selected,
  t,
}: {
  event: CachedEvent;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectOutcome: (outcome: Outcome, market: Market) => void;
  selected: SelectedOutcome | null;
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

  // Show top market (moneyline first, else first available) inline
  const topMarket =
    event.markets.find((m) => m.type === "moneyline") ?? event.markets[0];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 transition-colors">
      {/* Top row: event name + time + quick odds */}
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

        {/* Inline moneyline odds (compact) */}
        {topMarket && (
          <div className="flex gap-1 shrink-0">
            {topMarket.outcomes.slice(0, 3).map((outcome) => {
              const isSelected =
                selected?.event.id === event.id &&
                selected.market.key === topMarket.key &&
                selected.outcome.name === outcome.name;
              return (
                <button
                  key={outcome.name}
                  onClick={() => onSelectOutcome(outcome, topMarket)}
                  className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-xs transition-colors min-w-[52px] ${
                    isSelected
                      ? "bg-pf-brand text-white font-semibold"
                      : "bg-secondary hover:bg-pf-brand/10 hover:text-pf-brand border border-border"
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
                      const isSelected =
                        selected?.event.id === event.id &&
                        selected.market.key === market.key &&
                        selected.outcome.name === outcome.name;
                      return (
                        <button
                          key={outcome.name}
                          onClick={() => onSelectOutcome(outcome, market)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs transition-colors ${
                            isSelected
                              ? "border-pf-brand bg-pf-brand/10 text-pf-brand font-semibold"
                              : "border-border hover:border-pf-brand/40 hover:bg-muted/60"
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
