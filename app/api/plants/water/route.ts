import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { waterPlantsSchema } from "@/lib/validators";
import { markPlantsWatered } from "@/services/plants";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const json = await request.json();
    const payload = waterPlantsSchema.parse(json);
    const result = await markPlantsWatered(user.id, payload.plantIds, {
      concurrency: 4,
      wateredAt: payload.wateredAt ? new Date(payload.wateredAt) : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
