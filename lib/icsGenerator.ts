/**
 * Generate ICS (iCalendar) file content for timetable entries
 */

type DayOfWeek = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

interface TimetableEntry {
  id: string;
  semester: number;
  year: number;
  term: "FALL" | "SPRING" | "SUMMER";
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  venue?: string | null;
  classType: string;
  instructor?: string | null;
  notes?: string | null;
  course?: {
    code: string;
    name: string;
  } | null;
}

// Map day names to iCalendar day codes (0 = Sunday)
const DAY_MAP: Record<DayOfWeek, string> = {
  SUNDAY: "SU",
  MONDAY: "MO",
  TUESDAY: "TU",
  WEDNESDAY: "WE",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "SA",
};

function formatICSDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}`;
}

function getNextOccurrence(dayOfWeek: DayOfWeek, startDate: Date = new Date()): Date {
  const dayIndex = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"].indexOf(dayOfWeek);
  const today = new Date(startDate);
  const currentDay = today.getDay();
  
  let daysUntil = dayIndex - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function generateICS(entries: TimetableEntry[], endDate: Date = new Date("2026-05-01")): string {
  const lines: string[] = [];
  
  // ICS header
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push("PRODID:-//DegreePlanner//Timetable//EN");
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push("X-WR-CALNAME:Class Timetable");
  lines.push("X-WR-TIMEZONE:Asia/Kolkata");
  
  // Add timezone definition
  lines.push("BEGIN:VTIMEZONE");
  lines.push("TZID:Asia/Kolkata");
  lines.push("BEGIN:STANDARD");
  lines.push("DTSTART:19700101T000000");
  lines.push("TZOFFSETFROM:+0530");
  lines.push("TZOFFSETTO:+0530");
  lines.push("END:STANDARD");
  lines.push("END:VTIMEZONE");
  
  // Add events
  for (const entry of entries) {
    const courseCode = entry.course?.code || "Unknown";
    const courseName = entry.course?.name || "Class";
    const [startHour, startMinute] = entry.startTime.split(":").map(Number);
    const [endHour, endMinute] = entry.endTime.split(":").map(Number);
    
    // Get the first occurrence
    const firstOccurrence = getNextOccurrence(entry.dayOfWeek);
    
    // Set the time for start and end
    const startDateTime = new Date(firstOccurrence);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    const endDateTime = new Date(firstOccurrence);
    endDateTime.setHours(endHour, endMinute, 0, 0);
    
    // Format the end date for recurrence rule (YYYYMMDD)
    const untilDate = new Date(endDate);
    untilDate.setHours(23, 59, 59, 999);
    const untilStr = formatICSDate(untilDate).split("T")[0] + "T235959";
    
    // Create event
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${entry.id}@degreeplanner.local`);
    lines.push(`DTSTAMP:${formatICSDate(new Date())}`);
    lines.push(`DTSTART;TZID=Asia/Kolkata:${formatICSDate(startDateTime)}`);
    lines.push(`DTEND;TZID=Asia/Kolkata:${formatICSDate(endDateTime)}`);
    lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${DAY_MAP[entry.dayOfWeek]};UNTIL=${untilStr}`);
    lines.push(`SUMMARY:${escapeICSText(courseCode)} - ${escapeICSText(entry.classType)}`);
    
    // Build description
    const descParts: string[] = [];
    descParts.push(courseName);
    if (entry.instructor) descParts.push(`Instructor: ${entry.instructor}`);
    if (entry.notes) descParts.push(`Notes: ${entry.notes}`);
    if (descParts.length > 0) {
      lines.push(`DESCRIPTION:${escapeICSText(descParts.join("\\n"))}`);
    }
    
    if (entry.venue) {
      lines.push(`LOCATION:${escapeICSText(entry.venue)}`);
    }
    
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:OPAQUE");
    lines.push("END:VEVENT");
  }
  
  lines.push("END:VCALENDAR");
  
  return lines.join("\r\n");
}

export function downloadICS(entries: TimetableEntry[], filename: string = "timetable.ics", endDate?: Date) {
  const icsContent = generateICS(entries, endDate);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
