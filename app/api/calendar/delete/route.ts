import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { google } from "googleapis";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { eventId } = await req.json();
    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    // Get user's Google OAuth token
    const account = await db.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "google",
      },
    });

    if (!account?.access_token) {
      return NextResponse.json(
        { error: "Google account not connected" },
        { status: 400 }
      );
    }

    const calendar = google.calendar({
      version: "v3",
      auth: new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_ID,
        process.env.GOOGLE_OAUTH_SECRET,
        `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
      ),
    });

    // Use the access token
    calendar.auth?.setCredentials({
      access_token: account.access_token,
      refresh_token: account.refresh_token || undefined,
      expiry_date: account.expires_at ? account.expires_at * 1000 : undefined,
    });

    // Delete the event from Google Calendar
    await calendar.events.delete({
      calendarId: "primary",
      eventId: eventId,
    });

    // Remove eventId from timetable entry
    await db.timetableEntry.updateMany({
      where: {
        googleEventId: eventId,
      },
      data: {
        googleEventId: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete from Google Calendar" },
      { status: 500 }
    );
  }
}
