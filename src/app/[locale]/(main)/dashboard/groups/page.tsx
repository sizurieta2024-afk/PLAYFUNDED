import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { createServerClient } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { buildLoginPath } from "@/i18n/navigation";
import { hasTradingGroupAccess } from "@/lib/group-access";
import { getGroupMemberSummaries } from "@/lib/trading-group-stats";
import { TradingGroupsClient } from "@/components/groups/TradingGroupsClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "groups" });

  return {
    title: t("pageTitle"),
    description: t("pageDescription"),
  };
}

export default async function DashboardGroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
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

  const t = await getTranslations({ locale, namespace: "groups" });
  const [hasAccess, membership] = await Promise.all([
    hasTradingGroupAccess(user.id),
    prisma.tradingGroupMember.findUnique({
      where: { userId: user.id },
      include: {
        group: {
          select: {
            id: true,
            ownerId: true,
            name: true,
            code: true,
          },
        },
      },
    }),
  ]);

  const members = membership
    ? await getGroupMemberSummaries(membership.groupId, user.id)
    : [];

  const group = membership
    ? {
        ...membership.group,
        members,
      }
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-pf-brand">
          {t("eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-display font-bold text-foreground">
          {t("pageTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("pageDescription")}
        </p>
      </div>

      <TradingGroupsClient
        group={group}
        currentUserId={user.id}
        hasAccess={hasAccess}
        t={getGroupsCopy(t)}
      />
    </div>
  );
}

function getGroupsCopy(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    anonymous: t("anonymous"),
    alreadyInGroup: t("alreadyInGroup"),
    buyChallenge: t("buyChallenge"),
    copied: t("copied"),
    copy: t("copy"),
    createBody: t("createBody"),
    createButton: t("createButton"),
    createEyebrow: t("createEyebrow"),
    createTitle: t("createTitle"),
    deleteConfirm: t("deleteConfirm"),
    deleteGroup: t("deleteGroup"),
    error_already_in_group: t("error_already_in_group"),
    error_already_owns_group: t("error_already_owns_group"),
    error_code_generation_failed: t("error_code_generation_failed"),
    error_group_full: t("error_group_full"),
    error_group_not_found: t("error_group_not_found"),
    error_invalid_code: t("error_invalid_code"),
    error_invalid_name: t("error_invalid_name"),
    error_invalid_user: t("error_invalid_user"),
    error_member_not_found: t("error_member_not_found"),
    error_not_in_group: t("error_not_in_group"),
    error_not_group_owner: t("error_not_group_owner"),
    error_owner_must_delete: t("error_owner_must_delete"),
    error_purchase_required: t("error_purchase_required"),
    error_unauthenticated: t("error_unauthenticated"),
    error_unknown: t("error_unknown"),
    groupIntro: t("groupIntro"),
    groupLeaderboard: t("groupLeaderboard"),
    groupLeaderboardBody: t("groupLeaderboardBody"),
    groupNameLabel: t("groupNameLabel"),
    groupNamePlaceholder: t("groupNamePlaceholder"),
    inviteCodeLabel: t("inviteCodeLabel"),
    joinBody: t("joinBody"),
    joinButton: t("joinButton"),
    joinEyebrow: t("joinEyebrow"),
    joinTitle: t("joinTitle"),
    leaveConfirm: t("leaveConfirm"),
    leaveGroup: t("leaveGroup"),
    member: t("member"),
    memberTools: t("memberTools"),
    memberToolsBody: t("memberToolsBody"),
    members: t("members"),
    noChallengeYet: t("noChallengeYet"),
    owner: t("owner"),
    ownerTools: t("ownerTools"),
    pendingPicks: t("pendingPicks"),
    phase: t("phase"),
    phase_funded: t("phase_funded"),
    phase_phase1: t("phase_phase1"),
    phase_phase2: t("phase_phase2"),
    pnl: t("pnl"),
    privateGroup: t("privateGroup"),
    privacyBody: t("privacyBody"),
    privacyTitle: t("privacyTitle"),
    purchaseRequiredBody: t("purchaseRequiredBody"),
    purchaseRequiredTitle: t("purchaseRequiredTitle"),
    regenerateCode: t("regenerateCode"),
    removeMember: t("removeMember"),
    renameGroup: t("renameGroup"),
    showStakeAmounts: t("showStakeAmounts"),
    status: t("status"),
    status_active: t("status_active"),
    status_failed: t("status_failed"),
    status_funded: t("status_funded"),
    status_passed: t("status_passed"),
    working: t("working"),
    winRate: t("winRate"),
    picks: t("picks"),
    youBadge: t("youBadge"),
  };
}
