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

export async function POST(request: NextRequest) {
  try {
    assertDevMode();
    await requireApiUser();
    const dayOffset = parseDayOffset(request.nextUrl.searchParams.get("dayOffset"));
    const summary = await sendDailyWateringReminders({
      now: getCurrentDate(dayOffset),
      debug: true
    });
    return NextResponse.json(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}
