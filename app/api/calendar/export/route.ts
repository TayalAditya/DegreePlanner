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

// Format a Date as local ISO datetime string without Z suffix
// This way, Google Calendar + timeZone:Asia/Kolkata interprets the time as IST (not UTC)
function toLocalDateTimeString(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

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

    // Force-refresh the access token before making API calls.
    // Stored access_tokens expire after ~1 hour; this ensures we use a valid one.
    try {
      const tokenInfo = await oauth2Client.getAccessToken();
      if (!tokenInfo.token) {
        return NextResponse.json(
          { error: "Could not obtain a valid Google access token. Please sign out and sign in again." },
          { status: 401 }
        );
      }
      // Persist the refreshed token to DB so future calls don't need to refresh again
      const refreshed = oauth2Client.credentials;
      if (refreshed.access_token && refreshed.access_token !== account.access_token) {
        await prisma.account.update({
          where: { id: account.id },
          data: {
            access_token: refreshed.access_token,
            expires_at: refreshed.expiry_date
              ? Math.floor(refreshed.expiry_date / 1000)
              : account.expires_at,
          },
        });
      }
    } catch (tokenError: any) {
      const msg: string = tokenError.message || "";
      console.error("[Calendar] Token refresh failed:", msg);
      if (msg.includes("invalid_grant") || msg.includes("Token has been expired or revoked")) {
        return NextResponse.json(
          { error: "Your Google session has expired. Please sign out and sign in again to re-authorize calendar access." },
          { status: 401 }
        );
      }
      return NextResponse.json(
        { error: `Failed to authenticate with Google: ${msg}. Please sign out and sign in again.` },
        { status: 401 }
      );
    }

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
          dateTime: toLocalDateTimeString(startDateTime),
          timeZone: "Asia/Kolkata",
        },
        end: {
          dateTime: toLocalDateTimeString(endDateTime),
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
        const googleErr = error?.response?.data?.error;
        const errMsg = error?.response?.data?.error_description
          || (typeof googleErr === "string" ? googleErr : googleErr?.message)
          || error?.message
          || error?.errors?.[0]?.message
          || "Unknown error";
        console.error("[Calendar] Failed entry", entry.id, "- status:", error?.response?.status, "error:", errMsg);
        failedEvents.push({ entryId: entry.id, error: errMsg });
      }
    }

    const firstErrMsg = failedEvents[0]?.error || "";
    const needsReauth = createdEvents.length === 0 && failedEvents.length > 0 &&
      /insufficient|scope|unauthorized|invalid_grant|token|forbidden|401|403/i.test(firstErrMsg);

    return NextResponse.json({
      success: createdEvents.length > 0,
      message: `${createdEvents.length} events added to Google Calendar${failedEvents.length > 0 ? `, ${failedEvents.length} failed` : ""}`,
      events: createdEvents,
      failures: failedEvents,
      needs_reauth: needsReauth,
    });
  } catch (error: any) {
    console.error("Calendar export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export to Google Calendar" },
      { status: 500 }
    );
  }
}
