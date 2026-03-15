import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { plantSearchQuerySchema } from "@/lib/validators";
import { searchPlantsByName } from "@/services/plant-id";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const query = plantSearchQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q")
    });
    const suggestions = await searchPlantsByName(query.q);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
