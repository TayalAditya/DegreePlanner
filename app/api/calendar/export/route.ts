import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// @ts-ignore - googleapis types might not be available in dev
import { google } from "googleapis";

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

const DAY_MAP: Record<DayOfWeek, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

function getNextOccurrence(dayOfWeek: DayOfWeek, startDate: Date = new Date()): Date {
  const targetDay = DAY_MAP[dayOfWeek];
  const today = new Date(startDate);
  const currentDay = today.getDay();
  
  let daysUntil = targetDay - currentDay;
  if (daysUntil < 0) daysUntil += 7;
  
  const nextDate = new Date(today);
  nextDate.setDate(today.getDate() + daysUntil);
  return nextDate;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user has granted calendar scope
    const account = await prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "Google Calendar access not available. Please sign in again." },
        { status: 403 }
      );
    }

    const { entries } = await request.json();

    if (!entries || !Array.isArray(entries)) {
      return NextResponse.json({ error: "Invalid entries" }, { status: 400 });
    }

    // Set up Google Calendar API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const endDate = new Date("2026-05-01");
    const createdEvents: { entryId: string; eventId: string }[] = [];
    const failedEvents: { entryId: string; error: string }[] = [];

    // Create events
    for (const entry of entries as TimetableEntry[]) {
      const courseCode = entry.course?.code || "Unknown";
      const courseName = entry.course?.name || "Class";
      const [startHour, startMinute] = entry.startTime.split(":").map(Number);
      const [endHour, endMinute] = entry.endTime.split(":").map(Number);

      const firstOccurrence = getNextOccurrence(entry.dayOfWeek);
      const startDateTime = new Date(firstOccurrence);
      startDateTime.setHours(startHour, startMinute, 0, 0);

      const endDateTime = new Date(firstOccurrence);
      endDateTime.setHours(endHour, endMinute, 0, 0);

      const dayCode = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][DAY_MAP[entry.dayOfWeek]];
      const untilDate = endDate.toISOString().split("T")[0].replace(/-/g, "");

      const description = [
        courseName,
        entry.instructor ? `Instructor: ${entry.instructor}` : null,
        entry.notes ? `Notes: ${entry.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const event = {
        summary: `${courseCode} - ${entry.classType}`,
        location: entry.venue || undefined,
        description,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: "Asia/Kolkata",
        },
        recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${dayCode};UNTIL=${untilDate}T235959Z`],
        colorId: entry.classType === "TA_DUTY" ? "5" : undefined, // Banana color for TA duties
      };

      try {
        const response = await calendar.events.insert({
          calendarId: "primary",
          requestBody: event,
        });

        const eventId = response.data.id;
        if (eventId) {
          // Save event ID to database
          await prisma.timetableEntry.update({
            where: { id: entry.id },
            data: { googleEventId: eventId },
          });
          createdEvents.push({ entryId: entry.id, eventId });
        }
      } catch (error: any) {
        const errMsg = error?.message || error?.errors?.[0]?.message || "Unknown error";
        console.error("[Calendar] Failed to create event for entry", entry.id, ":", errMsg);
        failedEvents.push({ entryId: entry.id, error: errMsg });
      }
    }

    return NextResponse.json({
      success: createdEvents.length > 0,
      message: `${createdEvents.length} events added to Google Calendar${failedEvents.length > 0 ? `, ${failedEvents.length} failed` : ""}`,
      events: createdEvents,
      failures: failedEvents,
    });
  } catch (error: any) {
    console.error("Calendar export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export to Google Calendar" },
      { status: 500 }
    );
  }
}
