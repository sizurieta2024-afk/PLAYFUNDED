import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { buildLoginPath } from "@/i18n/navigation";
import { getGroupMemberSummaries } from "@/lib/trading-group-stats";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "groups" });

  return {
    title: t("memberProfileTitle"),
  };
}

export default async function GroupMemberProfilePage({
  params,
}: {
  params: Promise<{ locale: string; memberId: string }>;
}) {
  const { locale, memberId } = await params;
  const supabase = await createServerClient();
  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) redirect(buildLoginPath(locale));

  const user = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true },
  });
  if (!user) redirect(buildLoginPath(locale));

  const membership = await prisma.tradingGroupMember.findUnique({
    where: { userId: user.id },
    select: { groupId: true },
  });
  if (!membership) notFound();

  const t = await getTranslations({ locale, namespace: "groups" });
  const members = await getGroupMemberSummaries(membership.groupId, user.id);
  const member = members.find((entry) => entry.userId === memberId);
  if (!member) notFound();

  const challenge = member.challenge;

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      <Link
        href="/dashboard/groups"
        className="text-xs font-semibold text-pf-brand hover:text-pf-brand-dark"
      >
        ← {t("backToGroup")}
      </Link>

      <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pf-brand/15 text-xl font-black text-pf-brand">
              {(member.name ?? "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-pf-brand">
                {member.role === "owner" ? t("owner") : t("member")}
              </p>
              <h1 className="mt-1 text-2xl font-black text-foreground">
                {member.name ?? t("anonymous")}
                {member.isCurrentUser ? ` ${t("youBadge")}` : ""}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {challenge ? challenge.tierName : t("noChallengeYet")}
              </p>
            </div>
          </div>
        </div>

        {challenge ? (
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            <ProfileStat
              label={t("pnl")}
              value={formatPct(challenge.pnlPct)}
              accent={challenge.pnlCents >= 0 ? "text-pf-brand" : "text-red-300"}
            />
            <ProfileStat
              label={t("winRate")}
              value={
                challenge.winRate === null
                  ? "—"
                  : `${challenge.winRate.toFixed(0)}%`
              }
            />
            <ProfileStat label={t("picks")} value={String(challenge.picksCount)} />
            <ProfileStat
              label={t("status")}
              value={t(`status_${challenge.status}` as Parameters<typeof t>[0])}
            />
          </div>
        ) : (
          <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("noChallengeYet")}
          </p>
        )}
      </section>

      {challenge && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {t("recentActivity")}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {member.showStakeAmounts
                  ? t("stakeAmountsVisible")
                  : t("stakeAmountsHidden")}
              </p>
            </div>
          </div>

          {challenge.recentPicks.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("noPicksYet")}
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border">
              {challenge.recentPicks.map((pick) => (
                <div
                  key={pick.id}
                  className="grid gap-3 bg-background px-4 py-3 sm:grid-cols-[1fr_90px_90px_90px] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {pick.selection}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {pick.eventName ?? pick.league}
                    </p>
                  </div>
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {pick.odds.toFixed(2)} {t("odds")}
                  </p>
                  <p className="text-xs font-semibold tabular-nums text-muted-foreground">
                    {formatStake(
                      pick.stake,
                      challenge.startBalance,
                      member.showStakeAmounts,
                      t("unit"),
                    )}
                  </p>
                  <p className="text-xs font-bold text-foreground">
                    {t(`pick_${pick.status}` as Parameters<typeof t>[0])}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ProfileStat({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-2 text-xl font-black tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatStake(
  stake: number,
  startBalance: number,
  showAmount: boolean,
  unitLabel: string,
) {
  if (showAmount) {
    return `$${(stake / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (startBalance <= 0) return "—";
  return `${((stake / startBalance) * 100).toFixed(1)}% ${unitLabel}`;
}
