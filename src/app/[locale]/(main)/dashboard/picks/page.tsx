import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { PicksClient } from "@/components/challenge/PicksClient";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "picks" });
  return { title: t("pageTitle") };
}

export default async function PicksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const supabase = createServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/auth/login");
  }

  const t = await getTranslations({ locale, namespace: "picks" });

  // Resolve the Prisma user
  const user = await prisma.user.findFirst({
    where: { supabaseId: session.user.id },
  });

  if (!user) {
    redirect("/auth/login");
  }

  // Get the most recent active challenge with tier info
  const challenge = await prisma.challenge.findFirst({
    where: {
      userId: user.id,
      status: { in: ["active", "funded"] },
    },
    orderBy: { createdAt: "desc" },
    include: { tier: true },
  });

  // If no active challenge, prompt to buy one
  if (!challenge) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">{t("noChallenge")}</p>
        <a
          href="/challenges"
          className="inline-block px-6 py-2.5 rounded-lg bg-pf-brand text-white text-sm font-semibold hover:bg-pf-brand/90 transition-colors"
        >
          {t("buyChallenge")}
        </a>
      </div>
    );
  }

  // Fetch the 50 most recent picks
  const picks = await prisma.pick.findMany({
    where: { challengeId: challenge.id },
    orderBy: { placedAt: "desc" },
    take: 50,
  });

  // Build the translations object for the client component
  const tObj: Record<string, string> = {
    balance: t("balance"),
    phase: t("phase"),
    phase1: t("phase1"),
    phase2: t("phase2"),
    funded: t("funded"),
    target: t("target"),
    progress: t("progress"),
    maxStake: t("maxStake"),
    settled: t("settled"),
    allLeagues: t("allLeagues"),
    noEvents: t("noEvents"),
    noEventsHint: t("noEventsHint"),
    selectOutcome: t("selectOutcome"),
    moneyline: t("moneyline"),
    spread: t("spread"),
    total: t("total"),
    over: t("over"),
    under: t("under"),
    draw: t("draw"),
    stakeLabel: t("stakeLabel"),
    stakePlaceholder: t("stakePlaceholder"),
    stakeHint: t("stakeHint", { max: "{max}" }),
    potentialPayout: t("potentialPayout"),
    odds: t("odds"),
    confirmPick: t("confirmPick"),
    placing: t("placing"),
    pickPlaced: t("pickPlaced"),
    recentPicks: t("recentPicks"),
    noPicks: t("noPicks"),
    pending: t("pending"),
    won: t("won"),
    lost: t("lost"),
    void: t("void"),
    push: t("push"),
    vs: t("vs"),
    starts: t("starts"),
    live: t("live"),
    point: t("point"),
  };

  // Serialize challenge for client (strip BigInt / Date issues)
  const challengeData = {
    id: challenge.id,
    balance: challenge.balance,
    startBalance: challenge.startBalance,
    phase: challenge.phase,
    status: challenge.status,
    phase1StartBalance: challenge.phase1StartBalance,
    phase2StartBalance: challenge.phase2StartBalance,
    tier: {
      name: challenge.tier.name,
      profitSplitPct: challenge.tier.profitSplitPct,
      minPicks: challenge.tier.minPicks,
    },
  };

  const picksData = picks.map((p) => ({
    id: p.id,
    sport: p.sport,
    league: p.league,
    eventName: p.eventName,
    marketType: p.marketType,
    selection: p.selection,
    odds: p.odds,
    stake: p.stake,
    potentialPayout: p.potentialPayout,
    status: p.status,
    placedAt: p.placedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">{t("pageTitle")}</h1>
      <PicksClient
        challenge={challengeData}
        initialPicks={picksData}
        t={tObj}
      />
    </div>
  );
}
