// ============================================================
// EVENT LOCK — funded traders cannot place picks within 30 min of event start
// Challenge-phase and standard-phase users are not subject to this rule.
// ============================================================

const LOCK_MINUTES = 30;
const LOCK_MS = LOCK_MINUTES * 60 * 1000;

// Returns true if the event is within the 30-minute lock window.
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
