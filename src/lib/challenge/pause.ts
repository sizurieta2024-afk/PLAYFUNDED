// ============================================================
// PAUSE — 48-hour challenge pause (one per challenge attempt)
// Only allowed during active phase1/phase2 — not funded phase.
// ============================================================

import type { Challenge } from "@prisma/client";

const PAUSE_DURATION_HOURS = 48;

export interface PauseViolation {
  code: "PAUSE_ALREADY_USED" | "PAUSE_NOT_ALLOWED_FUNDED" | "CHALLENGE_NOT_ACTIVE";
  error: string;
}

// Returns null if pause can be activated, or a violation describing why not.
export function canActivatePause(challenge: Challenge): PauseViolation | null {
  if (challenge.status !== "active") {
    return {
      code: "CHALLENGE_NOT_ACTIVE",
      error: "Can only pause an active challenge",
    };
  }
  if (challenge.phase === "funded") {
    return {
      code: "PAUSE_NOT_ALLOWED_FUNDED",
      error: "Funded accounts cannot be paused",
    };
  }
  if (challenge.pauseUsed) {
    return {
      code: "PAUSE_ALREADY_USED",
      error: "Pause has already been used for this challenge",
    };
  }
  return null;
}

// Returns Prisma update data to activate the pause.
export function buildActivatePause(): { pausedUntil: Date; pauseUsed: boolean } {
  const pausedUntil = new Date();
  pausedUntil.setHours(pausedUntil.getHours() + PAUSE_DURATION_HOURS);
  return { pausedUntil, pauseUsed: true };
}

// Returns true if a paused challenge's pause window has expired.
export function isPauseExpired(challenge: Challenge): boolean {
  if (!challenge.pausedUntil) return false;
  return new Date() >= challenge.pausedUntil;
}

// Returns true if the challenge is currently in a pause window.
export function isChallengePaused(challenge: Challenge): boolean {
  if (!challenge.pausedUntil) return false;
  return new Date() < challenge.pausedUntil;
}
