import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { getDevModeState } from "@/lib/dev-mode";
import { toErrorResponse } from "@/lib/http";
import { dashboardActionSchema, dashboardQuerySchema } from "@/lib/validators";
import { getDashboard, markDashboardSectionWatered } from "@/services/plants";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const query = dashboardQuerySchema.parse({
      vaultId: request.nextUrl.searchParams.get("vaultId")
    });
    const devMode = getDevModeState({
      devMode: request.nextUrl.searchParams.get("devMode") ?? undefined,
      dayOffset: request.nextUrl.searchParams.get("dayOffset") ?? undefined
    });
    const dashboard = await getDashboard(user.id, query.vaultId, {
      now: devMode.now
    });
    return NextResponse.json(dashboard);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const json = await request.json();
    const payload = dashboardActionSchema.parse(json);
    const devMode = getDevModeState({
      devMode: payload.devMode,
      dayOffset: payload.dayOffset
    });
    const result = await markDashboardSectionWatered(user.id, payload.vaultId, payload.section, {
      now: devMode.now
    });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
