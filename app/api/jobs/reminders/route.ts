import { NextRequest, NextResponse } from "next/server";
import { sendDailyWateringReminders } from "@/services/reminders";
import { ApiError, toErrorResponse } from "@/lib/http";

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new ApiError(500, "CRON_SECRET is not configured");
  }

  const headerSecret =
    request.headers.get("authorization")?.replace("Bearer ", "") ??
    request.headers.get("x-cron-secret");

  if (headerSecret !== secret) {
    throw new ApiError(401, "Unauthorized");
  }
}

export async function POST(request: NextRequest) {
  try {
    authorize(request);
    const summary = await sendDailyWateringReminders();
    return NextResponse.json(summary);
  } catch (error) {
    return toErrorResponse(error);
  }
}

// Vercel Cron invokes the path with GET and a `Authorization: Bearer CRON_SECRET` header
export async function GET(request: NextRequest) {
  return POST(request);
}
