import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { getDevModeState } from "@/lib/dev-mode";
import { toErrorResponse } from "@/lib/http";
import { dashboardQuerySchema } from "@/lib/validators";
import { getDashboard } from "@/services/plants";

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
