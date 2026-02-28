import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { createServerClient } from "@/lib/supabase";
import { FollowButton } from "@/components/community/FollowButton";

export default async function TraderProfilePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("leaderboard");

  const challenge = await prisma.challenge.findUnique({
    where: { id, status: "funded" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
          followers: { select: { followerId: true } },
        },
      },
      tier: { select: { name: true, fundedBankroll: true, profitSplitPct: true } },
      picks: {
        where: { status: { in: ["won", "lost", "push", "void"] } },
        orderBy: { placedAt: "desc" },
        take: 20,
        select: {
          id: true,
          eventName: true,
          league: true,
          selection: true,
          odds: true,
          status: true,
          placedAt: true,
        },
      },
    },
  });

  if (!challenge) notFound();

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let currentUserId: string | null = null;
  let isFollowing = false;
  let isSelf = false;

  if (session) {
    const me = await prisma.user.findFirst({
      where: { supabaseId: session.user.id },
      select: { id: true },
    });
    currentUserId = me?.id ?? null;
    isSelf = currentUserId === challenge.user.id;
    isFollowing = challenge.user.followers.some(
      (f) => f.followerId === currentUserId,
    );
  }

  const followerCount = challenge.user.followers.length;
  const pnl = challenge.balance - challenge.tier.fundedBankroll;
  const pnlPct = (pnl / challenge.tier.fundedBankroll) * 100;
  const settled = challenge.picks.filter(
    (p) => p.status === "won" || p.status === "lost" || p.status === "push",
  );
  const winRate =
    settled.length > 0
      ? (settled.filter((p) => p.status === "won").length / settled.length) * 100
      : 0;

  const STATUS_STYLES: Record<string, string> = {
    won: "bg-pf-brand/15 text-pf-brand",
    lost: "bg-red-500/15 text-red-400",
    push: "bg-muted text-muted-foreground",
    void: "bg-muted text-muted-foreground",
  };

  function formatUSD(cents: number) {
    return `$${(Math.abs(cents) / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
    })}`;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-pf-brand/15 text-pf-brand text-xl font-bold flex items-center justify-center">
            {(challenge.user.name ?? "?")[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {challenge.user.name ?? t("anonymous")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {challenge.tier.name} · {t("fundedTrader")}
            </p>
          </div>
        </div>
        {!isSelf && currentUserId && (
          <FollowButton
            traderId={challenge.user.id}
            isFollowing={isFollowing}
            followerCount={followerCount}
          />
        )}
        {!currentUserId && (
          <span className="text-xs text-muted-foreground">
            {followerCount} followers
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          {
            label: t("pnlPct"),
            value: `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(1)}%`,
            color: pnl >= 0 ? "text-pf-brand" : "text-red-400",
          },
          {
            label: "P&L",
            value: `${pnl >= 0 ? "+" : "-"}${formatUSD(pnl)}`,
            color: pnl >= 0 ? "text-pf-brand" : "text-red-400",
          },
          {
            label: t("winRate"),
            value: `${winRate.toFixed(0)}%`,
            color: "text-foreground",
          },
          {
            label: t("picks"),
            value: challenge.picks.length.toString(),
            color: "text-foreground",
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent picks */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-3">
          {t("recentPicks")}
        </h2>
        {challenge.picks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noPicks")}</p>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {challenge.picks.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  i < challenge.picks.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{p.selection}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.eventName ?? p.league} · {p.odds.toFixed(2)}
                  </p>
                </div>
                <span
                  className={`shrink-0 px-2 py-0.5 rounded-md text-xs font-semibold ${
                    STATUS_STYLES[p.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
