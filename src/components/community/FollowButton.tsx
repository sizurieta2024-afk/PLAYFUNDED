"use client";

import { useTransition } from "react";
import { followTrader, unfollowTrader } from "@/app/actions/community";

export function FollowButton({
  traderId,
  isFollowing,
  followerCount,
}: {
  traderId: string;
  isFollowing: boolean;
  followerCount: number;
}) {
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      if (isFollowing) {
        await unfollowTrader(traderId);
      } else {
        await followTrader(traderId);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={pending}
        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
          isFollowing
            ? "border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            : "bg-pf-brand text-white hover:bg-pf-brand/90"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
      <span className="text-xs text-muted-foreground">
        {followerCount} {followerCount === 1 ? "follower" : "followers"}
      </span>
    </div>
  );
}
