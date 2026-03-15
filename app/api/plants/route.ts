import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { addPlantSchema } from "@/lib/validators";
import { createPlant } from "@/services/plants";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const json = await request.json();
    const payload = addPlantSchema.parse(json);

    const plant = await createPlant({
      userId: user.id,
      vaultId: payload.vaultId,
      species: payload.species,
      nickname: payload.nickname || undefined,
      image: payload.image
    });

    return NextResponse.json({ plant }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
