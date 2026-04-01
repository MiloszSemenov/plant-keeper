import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { plantSearchQuerySchema } from "@/lib/validators";
import { suggestPlantSpecies } from "@/services/plant-care";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const query = plantSearchQuerySchema.parse({
      q: request.nextUrl.searchParams.get("q")
    });
    const matches = await suggestPlantSpecies(query.q);

    return NextResponse.json({
      savedMatches: matches
        .filter((match) => match.source === "database" || match.source === "alias")
        .map((match) => ({
          id: `${match.source}:${match.latinName}`,
          species: match.latinName,
          imageUrl: match.imageUrl,
          aliases: []
        })),
      suggestions: matches
        .filter((match) => match.source === "plant_id" || match.source === "ai")
        .map((match) => ({
          species: match.latinName,
          commonNames: match.commonName ? [match.commonName] : [],
          description: null,
          url: null,
          imageUrl: match.imageUrl
        }))
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
