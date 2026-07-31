/** Server-side validation for official Aug–Nov 2026 timetable slots. */
import { IC_SLOTS, LAB_SLOTS, NON_IC_FOURTH_SESSION, NON_IC_SLOTS } from "@/lib/officialTimetable";

const FREE_SLOT_PATTERN = /^(FS|FS[1-4]|NS|PC LAB)$/i;

/**
 * Returns true only when a submitted slot/day/start combination belongs to
 * the published IC/non-IC/lab tables. Free or unscheduled entries require
 * explicit admin approval.
 */
export function isApproveableSlot(
  slot: string | undefined,
  dayOfWeek: string,
  startTime: string,
): boolean {
  if (!slot) return false;
  const normalized = slot.trim().toUpperCase();
  if (!normalized || FREE_SLOT_PATTERN.test(normalized)) return false;

  if (/^L[1-5]$/.test(normalized)) {
    return (LAB_SLOTS[normalized] ?? []).some(
      (session) => session.dayOfWeek === dayOfWeek && session.startTime === startTime,
    );
  }

  if (/^[A-H]$/.test(normalized)) {
    const sessions = [
      ...(NON_IC_SLOTS[normalized] ?? []),
      ...(IC_SLOTS[normalized] ?? []),
      ...(NON_IC_FOURTH_SESSION[normalized] ? [NON_IC_FOURTH_SESSION[normalized]] : []),
    ];
    return sessions.some(
      (session) => session.dayOfWeek === dayOfWeek && session.startTime === startTime,
    );
  }

  const tokens = normalized.split(/[\s,+&]+/).filter(Boolean);
  return tokens.length > 1 && tokens.some((token) => isApproveableSlot(token, dayOfWeek, startTime));
}
