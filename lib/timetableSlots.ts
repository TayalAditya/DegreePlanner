/**
 * Server-side timetable slot definitions and validation.
 * Mirrors the slot tables in TimetableView.tsx so API routes can validate
 * submissions without relying on client-sent data.
 */

interface SlotSession {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
}

const NON_IC_SLOTS: Record<string, SlotSession[]> = {
  A: [
    { dayOfWeek: "MONDAY",    startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "TUESDAY",   startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "THURSDAY",  startTime: "09:00", endTime: "09:50" },
  ],
  B: [
    { dayOfWeek: "MONDAY",    startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "TUESDAY",   startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "THURSDAY",  startTime: "10:00", endTime: "10:50" },
  ],
  C: [
    { dayOfWeek: "MONDAY",    startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "THURSDAY",  startTime: "11:00", endTime: "11:50" },
  ],
  D: [
    { dayOfWeek: "MONDAY",    startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "THURSDAY",  startTime: "12:00", endTime: "12:50" },
  ],
  E: [
    { dayOfWeek: "MONDAY",    startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "FRIDAY",    startTime: "09:00", endTime: "09:50" },
  ],
  F: [
    { dayOfWeek: "TUESDAY",   startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "FRIDAY",    startTime: "11:00", endTime: "11:50" },
  ],
  G: [
    { dayOfWeek: "TUESDAY",   startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "THURSDAY",  startTime: "08:00", endTime: "08:50" },
    { dayOfWeek: "FRIDAY",    startTime: "10:00", endTime: "10:50" },
  ],
  H: [
    { dayOfWeek: "TUESDAY",   startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY",    startTime: "08:00", endTime: "08:50" },
  ],
};

const IC_SLOTS: Record<string, SlotSession[]> = {
  A: [
    { dayOfWeek: "MONDAY",    startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "FRIDAY",    startTime: "09:00", endTime: "09:50" },
  ],
  B: [
    { dayOfWeek: "MONDAY",    startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "FRIDAY",    startTime: "11:00", endTime: "11:50" },
  ],
  C: [
    { dayOfWeek: "TUESDAY",   startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "THURSDAY",  startTime: "10:00", endTime: "10:50" },
  ],
  D: [
    { dayOfWeek: "MONDAY",    startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "TUESDAY",   startTime: "09:00", endTime: "09:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "10:00", endTime: "10:50" },
    { dayOfWeek: "FRIDAY",    startTime: "10:00", endTime: "10:50" },
  ],
  E: [
    { dayOfWeek: "TUESDAY",   startTime: "11:00", endTime: "11:50" },
    { dayOfWeek: "THURSDAY",  startTime: "11:00", endTime: "11:50" },
  ],
  F: [
    { dayOfWeek: "MONDAY",    startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "WEDNESDAY", startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "FRIDAY",    startTime: "12:00", endTime: "12:50" },
  ],
  G: [
    { dayOfWeek: "TUESDAY",   startTime: "12:00", endTime: "12:50" },
    { dayOfWeek: "THURSDAY",  startTime: "12:00", endTime: "12:50" },
  ],
  H: [
    { dayOfWeek: "THURSDAY",  startTime: "09:00", endTime: "09:50" },
  ],
};

const LAB_SLOTS: Record<string, SlotSession[]> = {
  L1: [{ dayOfWeek: "MONDAY",    startTime: "14:00", endTime: "17:00" }],
  L2: [{ dayOfWeek: "TUESDAY",   startTime: "14:00", endTime: "17:00" }],
  L3: [{ dayOfWeek: "WEDNESDAY", startTime: "14:00", endTime: "17:00" }],
  L4: [{ dayOfWeek: "THURSDAY",  startTime: "14:00", endTime: "17:00" }],
  L5: [{ dayOfWeek: "FRIDAY",    startTime: "14:00", endTime: "17:00" }],
};

/**
 * Slots that are "free" / unscheduled — these always require admin approval
 * because they don't correspond to a fixed official timetable slot.
 */
const FREE_SLOT_PATTERN = /^(FS|FS1|FS2|NS)$/i;

/**
 * Returns true when the submitted (slot, dayOfWeek, startTime) combination
 * exactly matches an entry in the official slot tables.
 *
 * Rules:
 *  - No slot → false (needs approval)
 *  - FS / FS1 / FS2 / NS → false (free/unscheduled, needs approval)
 *  - A-H lecture slot → true only if dayOfWeek+startTime matches NON_IC or IC table
 *  - L1-L5 lab slot   → true only if dayOfWeek+startTime matches LAB table
 *  - Anything else    → false
 */
export function isApproveableSlot(
  slot: string | undefined,
  dayOfWeek: string,
  startTime: string,
): boolean {
  if (!slot) return false;

  const s = slot.trim().toUpperCase();
  if (!s) return false;

  // Free/unscheduled slots always require approval
  if (FREE_SLOT_PATTERN.test(s)) return false;

  // Lab slots L1-L5
  if (/^L[1-5]$/.test(s)) {
    const sessions = LAB_SLOTS[s] ?? [];
    return sessions.some(
      (sess) => sess.dayOfWeek === dayOfWeek && sess.startTime === startTime,
    );
  }

  // Lecture slots A-H
  if (/^[A-H]$/.test(s)) {
    const nonIcSessions = NON_IC_SLOTS[s] ?? [];
    const icSessions    = IC_SLOTS[s]    ?? [];
    return (
      nonIcSessions.some((sess) => sess.dayOfWeek === dayOfWeek && sess.startTime === startTime) ||
      icSessions.some(   (sess) => sess.dayOfWeek === dayOfWeek && sess.startTime === startTime)
    );
  }

  // Compound slot (e.g. "A L1"): auto-approve only if every token is valid
  // for the submitted day+time (at least one token must match the exact session).
  const tokens = s.split(/[\s,+]+/).filter(Boolean);
  if (tokens.length > 1) {
    // At least one token must validate against the day+time
    return tokens.some((token) => isApproveableSlot(token, dayOfWeek, startTime));
  }

  return false;
}
