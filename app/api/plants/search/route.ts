import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { searchUserPlants } from "@/services/plants";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const query = request.nextUrl.searchParams.get("q") ?? "";
    const plants = await searchUserPlants(user.id, query);

    return NextResponse.json({ plants });
  } catch (error) {
    return toErrorResponse(error);
  }
}
