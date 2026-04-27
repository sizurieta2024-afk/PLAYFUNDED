import { prisma } from "@/lib/prisma";

const SETTLED_RESULT_STATUSES = new Set(["won", "lost"]);

export interface GroupRecentPick {
  id: string;
  eventName: string | null;
  league: string;
  selection: string;
  odds: number;
  stake: number;
  status: string;
  placedAt: Date;
}

export interface GroupChallengeSummary {
  id: string;
  tierName: string;
  phase: string;
  status: string;
  balance: number;
  startBalance: number;
  pnlCents: number;
  pnlPct: number;
  winRate: number | null;
  picksCount: number;
  settledPicksCount: number;
  pendingPicksCount: number;
  recentPicks: GroupRecentPick[];
}

export interface GroupMemberSummary {
  membershipId: string;
  userId: string;
  name: string | null;
  avatar: string | null;
  role: string;
  showStakeAmounts: boolean;
  joinedAt: Date;
  isCurrentUser: boolean;
  challenge: GroupChallengeSummary | null;
}

export async function getGroupMemberSummaries(
  groupId: string,
  currentUserId: string,
): Promise<GroupMemberSummary[]> {
  const members = await prisma.tradingGroupMember.findMany({
    where: { groupId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
    orderBy: { joinedAt: "asc" },
  });

  const userIds = members.map((member) => member.userId);
  const challenges = await prisma.challenge.findMany({
    where: { userId: { in: userIds } },
    include: {
      tier: {
        select: {
          name: true,
        },
      },
      picks: {
        where: { status: { not: "void" } },
        orderBy: { placedAt: "desc" },
        select: {
          id: true,
          eventName: true,
          league: true,
          selection: true,
          odds: true,
          stake: true,
          status: true,
          placedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const challengeByUser = new Map<string, (typeof challenges)[number]>();
  for (const challenge of challenges) {
    if (!challengeByUser.has(challenge.userId)) {
      challengeByUser.set(challenge.userId, challenge);
    }
  }

  return members
    .map((member) => {
      const challenge = challengeByUser.get(member.userId);

      return {
        membershipId: member.id,
        userId: member.userId,
        name: member.user.name,
        avatar: member.user.avatar,
        role: member.role,
        showStakeAmounts: member.showStakeAmounts,
        joinedAt: member.joinedAt,
        isCurrentUser: member.userId === currentUserId,
        challenge: challenge ? summarizeChallenge(challenge) : null,
      };
    })
    .sort((a, b) => {
      if (a.role === "owner" && b.role !== "owner") return -1;
      if (a.role !== "owner" && b.role === "owner") return 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });
}

function summarizeChallenge(
  challenge: Awaited<
    ReturnType<typeof prisma.challenge.findMany>
  >[number] & {
    tier: { name: string };
    picks: GroupRecentPick[];
  },
): GroupChallengeSummary {
  const pnlCents = challenge.balance - challenge.startBalance;
  const pnlPct =
    challenge.startBalance > 0 ? (pnlCents / challenge.startBalance) * 100 : 0;
  const resultPicks = challenge.picks.filter((pick) =>
    SETTLED_RESULT_STATUSES.has(pick.status),
  );
  const wonPicks = resultPicks.filter((pick) => pick.status === "won").length;
  const winRate =
    resultPicks.length > 0 ? (wonPicks / resultPicks.length) * 100 : null;

  return {
    id: challenge.id,
    tierName: challenge.tier.name,
    phase: challenge.phase,
    status: challenge.status,
    balance: challenge.balance,
    startBalance: challenge.startBalance,
    pnlCents,
    pnlPct,
    winRate,
    picksCount: challenge.picks.length,
    settledPicksCount: resultPicks.length,
    pendingPicksCount: challenge.picks.filter((pick) => pick.status === "pending")
      .length,
    recentPicks: challenge.picks.slice(0, 8),
  };
}
