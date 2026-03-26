import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { disconnectGoogleCalendar } from "@/services/google-calendar";

export async function DELETE() {
  try {
    const user = await requireApiUser();
    const result = await disconnectGoogleCalendar(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
