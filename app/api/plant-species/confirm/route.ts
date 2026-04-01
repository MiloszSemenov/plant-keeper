import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { plantSpeciesConfirmSchema } from "@/lib/validators";
import { confirmPlantSpecies } from "@/services/plant-care";

export async function POST(request: NextRequest) {
  try {
    await requireApiUser();
    const json = await request.json();
    const payload = plantSpeciesConfirmSchema.parse(json);
    const result = await confirmPlantSpecies({
      latinName: payload.latinName,
      commonName: payload.commonName || undefined,
      imageUrl: payload.imageUrl || undefined
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
