import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { ApiError, toErrorResponse } from "@/lib/http";
import { getCurrentDate, parseDayOffset } from "@/lib/dev-mode";
import { sendDailyWateringReminders } from "@/services/reminders";

function assertDevMode() {
  if (process.env.NODE_ENV === "production") {
    throw new ApiError(404, "Not found");
  }
}

function parseBooleanFlag(value: string | null, fallback = false) {
  if (value === null) {
    return fallback;
  }

  return value === "true";
}

function parseDateParam(value: string | null) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, "Use date=YYYY-MM-DD");
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "Use date=YYYY-MM-DD");
  }

  return date;
}

export async function POST(request: NextRequest) {
  try {
    assertDevMode();
    await requireApiUser();
    const dateParam = request.nextUrl.searchParams.get("date");
    const parsedDate = parseDateParam(dateParam);
    const dayOffset = parseDayOffset(request.nextUrl.searchParams.get("dayOffset"));
    const forceCalendar = parseBooleanFlag(
      request.nextUrl.searchParams.get("forceCalendar")
    );
    const includeOverdue = parseBooleanFlag(request.nextUrl.searchParams.get("overdue"), true);
    const now = parsedDate ?? getCurrentDate(dayOffset);
    const summary = await sendDailyWateringReminders({
      now,
      debug: true,
      forceCalendar,
      includeOverdue
    });

    return NextResponse.json({
      request: {
        date: now.toISOString().slice(0, 10),
        dayOffset: parsedDate ? null : dayOffset,
        forceCalendar,
        overdue: includeOverdue
      },
      ...summary
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
