import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";

export default async function LeaderboardPage() {
  const t = await getTranslations("leaderboard");

  // Top funded traders by lifetime P&L (all funded challenges, best pnl%)
  const challenges = await prisma.challenge.findMany({
    where: { status: "funded" },
    orderBy: [
      { balance: "desc" },
    ],
    take: 100,
    include: {
      user: { select: { id: true, name: true, avatar: true } },
      tier: { select: { name: true, fundedBankroll: true } },
      picks: {
        where: { status: { in: ["won", "lost", "push"] } },
        select: { status: true },
      },
    },
  });

  // Compute stats per challenge and sort by pnl%
  const rows = challenges
    .map((c) => {
      const pnl = c.balance - c.tier.fundedBankroll;
      const pnlPct = (pnl / c.tier.fundedBankroll) * 100;
      const settled = c.picks.filter((p) => p.status !== "push");
      const wins = settled.filter((p) => p.status === "won").length;
      const winRate = settled.length > 0 ? (wins / settled.length) * 100 : 0;
      return { c, pnl, pnlPct, winRate, picks: c.picks.length };
    })
    .sort((a, b) => b.pnlPct - a.pnlPct)
    .slice(0, 50);

  function formatPct(n: number) {
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  }
  function formatUSD(cents: number) {
    return `$${(cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  }

  const medal = ["🥇", "🥈", "🥉"];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("pageSubtitle")}</p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">{t("empty")}</p>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {[t("rank"), t("trader"), t("tier"), t("pnlPct"), t("winRate"), t("picks"), ""].map(
                  (h, i) => (
                    <th
                      key={i}
                      className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, pnl, pnlPct, winRate, picks }, i) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3 text-sm font-bold text-muted-foreground w-12">
                    {i < 3 ? medal[i] : `#${i + 1}`}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-pf-brand/15 text-pf-brand text-xs font-bold flex items-center justify-center shrink-0">
                        {(c.user.name ?? "?")[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-foreground text-sm">
                        {c.user.name ?? t("anonymous")}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.tier.name}
                  </td>
                  <td
                    className={`px-4 py-3 tabular-nums text-sm font-semibold ${
                      pnl >= 0 ? "text-pf-brand" : "text-red-400"
                    }`}
                  >
                    {formatPct(pnlPct)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      ({formatUSD(pnl)})
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                    {winRate.toFixed(0)}%
                  </td>
                  <td className="px-4 py-3 tabular-nums text-xs text-muted-foreground">
                    {picks}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/traders/${c.id}`}
                      className="text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      {t("viewProfile")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
