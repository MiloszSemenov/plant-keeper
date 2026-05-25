import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { waterPlantSchema } from "@/lib/validators";
import { markPlantWatered } from "@/services/plants";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ plantId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { plantId } = await context.params;
    const json = await request.json().catch(() => ({}));
    const payload = waterPlantSchema.parse(json);
    const plant = await markPlantWatered(user.id, plantId, {
      wateredAt: payload.wateredAt ? new Date(payload.wateredAt) : undefined
    });
    return NextResponse.json({ plant });
  } catch (error) {
    return toErrorResponse(error);
  }
}
