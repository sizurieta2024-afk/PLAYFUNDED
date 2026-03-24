import { PLATFORM_POLICY } from "@/lib/platform-policy";

// ============================================================
// EVENT LOCK — no picks allowed once an event is too close to start.
// Live betting is never permitted.
// ============================================================

export const EVENT_LOCK_MINUTES = PLATFORM_POLICY.trading.eventLockMinutes;
const LOCK_MS = EVENT_LOCK_MINUTES * 60 * 1000;

// Returns true if the event is within the pre-start lock window.
export function isEventLocked(eventStart: Date | null | undefined): boolean {
  if (!eventStart) return false;
  const now = Date.now();
  const lockCutoff = eventStart.getTime() - LOCK_MS;
  return now >= lockCutoff;
}

// Returns the lock cutoff Date for display purposes.
export function getLockCutoff(eventStart: Date): Date {
  return new Date(eventStart.getTime() - LOCK_MS);
}
