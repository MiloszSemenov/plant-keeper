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
    const suggestions = await suggestPlantSpecies(query.q);

    return NextResponse.json(suggestions);
  } catch (error) {
    return toErrorResponse(error);
  }
}
