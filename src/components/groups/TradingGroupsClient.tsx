"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import {
  createTradingGroup,
  deleteTradingGroup,
  joinTradingGroup,
  leaveTradingGroup,
  regenerateTradingGroupCode,
  removeTradingGroupMember,
  renameTradingGroup,
  setGroupStakeVisibility,
} from "@/app/actions/groups";
import type { GroupMemberSummary } from "@/lib/trading-group-stats";

const MAX_GROUP_MEMBERS = 20;

interface GroupView {
  id: string;
  name: string;
  code: string;
  ownerId: string;
  members: GroupMemberSummary[];
}

interface Props {
  group: GroupView | null;
  currentUserId: string;
  hasAccess: boolean;
  t: Record<string, string>;
}

export function TradingGroupsClient({
  group,
  currentUserId,
  hasAccess,
  t,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [renameValue, setRenameValue] = useState(group?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const currentMember = group?.members.find((member) => member.isCurrentUser);
  const isOwner = group?.ownerId === currentUserId;

  function errorText(code: string | null) {
    if (!code) return null;
    return t[`error_${code}`] ?? t.error_unknown;
  }

  function run(action: () => Promise<{ error?: string }>, onSuccess?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
        return;
      }
      onSuccess?.();
      router.refresh();
    });
  }

  function copyCode() {
    if (!group) return;
    void navigator.clipboard?.writeText(group.code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <p className="text-sm font-semibold text-foreground">
          {t.purchaseRequiredTitle}
        </p>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {t.purchaseRequiredBody}
        </p>
        <Link
          href="/challenges"
          className="mt-5 inline-flex rounded-xl bg-pf-pink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-pf-pink-dark"
        >
          {t.buyChallenge}
        </Link>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-pf-brand">
            {t.createEyebrow}
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {t.createTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.createBody}</p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () => createTradingGroup({ name: createName }),
                () => setCreateName(""),
              );
            }}
          >
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.groupNameLabel}
            </label>
            <input
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              placeholder={t.groupNamePlaceholder}
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none transition focus:border-pf-brand/60 focus:ring-2 focus:ring-pf-brand/15"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-pf-pink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pf-pink-dark disabled:opacity-50"
            >
              {pending ? t.working : t.createButton}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-pf-brand">
            {t.joinEyebrow}
          </p>
          <h2 className="mt-2 text-xl font-bold text-foreground">
            {t.joinTitle}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{t.joinBody}</p>

          <form
            className="mt-6 space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              run(
                () => joinTradingGroup({ code: joinCode }),
                () => setJoinCode(""),
              );
            }}
          >
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.inviteCodeLabel}
            </label>
            <input
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value)}
              placeholder="A7K9Q2"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm uppercase tracking-[0.24em] outline-none transition focus:border-pf-brand/60 focus:ring-2 focus:ring-pf-brand/15"
            />
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition hover:border-pf-brand/50 hover:bg-pf-brand/10 disabled:opacity-50"
            >
              {pending ? t.working : t.joinButton}
            </button>
          </form>
        </section>

        {errorText(error) && (
          <p className="lg:col-span-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorText(error)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="relative p-6 sm:p-8">
          <div className="absolute right-0 top-0 h-32 w-64 bg-[radial-gradient(circle,rgba(201,168,76,0.15),transparent_65%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-pf-brand">
                {t.privateGroup}
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-foreground">
                {group.name}
              </h2>
              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                {t.groupIntro}
              </p>
            </div>

            <div className="rounded-2xl border border-pf-brand/25 bg-pf-brand/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-pf-brand">
                {t.inviteCodeLabel}
              </p>
              <div className="mt-2 flex items-center gap-3">
                <code className="rounded-lg bg-background px-3 py-2 font-mono text-lg font-black tracking-[0.22em] text-foreground">
                  {group.code}
                </code>
                <button
                  type="button"
                  onClick={copyCode}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:text-foreground"
                >
                  {copied ? t.copied : t.copy}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {group.members.length}/{MAX_GROUP_MEMBERS}{" "}
                {t.members}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">
                {t.groupLeaderboard}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.groupLeaderboardBody}
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {group.members.map((member, index) => (
              <MemberCard
                key={member.userId}
                member={member}
                rank={index + 1}
                isOwner={Boolean(isOwner)}
                t={t}
                onRemove={() =>
                  run(() => removeTradingGroupMember({ userId: member.userId }))
                }
              />
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h3 className="text-sm font-bold text-foreground">
              {t.privacyTitle}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t.privacyBody}
            </p>
            <label className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-3">
              <span className="text-xs font-semibold text-foreground">
                {t.showStakeAmounts}
              </span>
              <input
                type="checkbox"
                checked={Boolean(currentMember?.showStakeAmounts)}
                onChange={(event) =>
                  run(() =>
                    setGroupStakeVisibility({
                      showStakeAmounts: event.target.checked,
                    }),
                  )
                }
                className="h-4 w-4 accent-pf-brand"
              />
            </label>
          </section>

          {isOwner ? (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">
                {t.ownerTools}
              </h3>
              <form
                className="mt-4 space-y-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  run(() => renameTradingGroup({ name: renameValue }));
                }}
              >
                <input
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-pf-brand/60 focus:ring-2 focus:ring-pf-brand/15"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-pf-brand/50 hover:bg-pf-brand/10 disabled:opacity-50"
                >
                  {t.renameGroup}
                </button>
              </form>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(regenerateTradingGroupCode)}
                className="mt-3 w-full rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-pf-brand/50 hover:bg-pf-brand/10 disabled:opacity-50"
              >
                {t.regenerateCode}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t.deleteConfirm)) {
                    run(deleteTradingGroup);
                  }
                }}
                className="mt-3 w-full rounded-xl border border-red-500/25 px-3 py-2 text-xs font-bold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
              >
                {t.deleteGroup}
              </button>
            </section>
          ) : (
            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">
                {t.memberTools}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.memberToolsBody}
              </p>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  if (window.confirm(t.leaveConfirm)) {
                    run(leaveTradingGroup);
                  }
                }}
                className="mt-4 w-full rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground transition hover:border-red-500/30 hover:text-red-300 disabled:opacity-50"
              >
                {t.leaveGroup}
              </button>
            </section>
          )}
        </div>
      </section>

      {errorText(error) && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorText(error)}
        </p>
      )}
    </div>
  );
}

function MemberCard({
  member,
  rank,
  isOwner,
  t,
  onRemove,
}: {
  member: GroupMemberSummary;
  rank: number;
  isOwner: boolean;
  t: Record<string, string>;
  onRemove: () => void;
}) {
  const challenge = member.challenge;
  const pnl = challenge?.pnlCents ?? 0;
  const accent = pnl >= 0 ? "text-pf-brand" : "text-red-300";

  return (
    <div className="rounded-2xl border border-border bg-background p-4 transition hover:border-pf-brand/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pf-brand/15 text-xs font-black text-pf-brand">
            #{rank}
          </div>
          <div className="min-w-0">
            <Link
              href={`/dashboard/groups/${member.userId}`}
              className="truncate text-sm font-bold text-foreground hover:text-pf-brand"
            >
              {member.name ?? t.anonymous}
              {member.isCurrentUser ? ` ${t.youBadge}` : ""}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {member.role === "owner" ? t.owner : t.member}
              {challenge ? ` · ${challenge.tierName}` : ""}
            </p>
          </div>
        </div>

        {challenge ? (
          <div className="grid grid-cols-3 gap-3 text-right">
            <Stat label={t.pnl} value={formatPct(challenge.pnlPct)} accent={accent} />
            <Stat
              label={t.winRate}
              value={
                challenge.winRate === null
                  ? "—"
                  : `${challenge.winRate.toFixed(0)}%`
              }
            />
            <Stat label={t.picks} value={String(challenge.picksCount)} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t.noChallengeYet}</p>
        )}
      </div>

      {challenge && (
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <MiniBadge label={t.phase} value={t[`phase_${challenge.phase}`] ?? challenge.phase} />
          <MiniBadge
            label={t.status}
            value={t[`status_${challenge.status}`] ?? challenge.status}
          />
          <MiniBadge
            label={t.pendingPicks}
            value={String(challenge.pendingPicksCount)}
          />
        </div>
      )}

      {isOwner && member.role !== "owner" && (
        <button
          type="button"
          onClick={onRemove}
          className="mt-3 text-xs font-semibold text-muted-foreground transition hover:text-red-300"
        >
          {t.removeMember}
        </button>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-sm font-black tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}

function MiniBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
