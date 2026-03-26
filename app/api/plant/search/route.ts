import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { plantSearchQuerySchema } from "@/lib/validators";
import { searchPlantsByName } from "@/services/plant-id";
import { searchLocalPlantSpecies } from "@/services/plant-care";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const query = plantSearchQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q")
    });
    const [savedMatches, suggestions] = await Promise.all([
      searchLocalPlantSpecies(query.q),
      searchPlantsByName(query.q).catch((error) => {
        console.error("[plant-search] knowledge_base_failed", {
          query: query.q,
          error: error instanceof Error ? error.message : "unknown_error"
        });
        return [];
      })
    ]);
    return NextResponse.json({ savedMatches, suggestions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
