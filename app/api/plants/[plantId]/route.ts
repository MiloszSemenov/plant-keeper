import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { updatePlantSchema } from "@/lib/validators";
import { deletePlant, getPlantDetail, updatePlant } from "@/services/plants";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ plantId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { plantId } = await context.params;
    const plant = await getPlantDetail(user.id, plantId);
    return NextResponse.json({ plant });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ plantId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { plantId } = await context.params;
    const json = await request.json();
    const payload = updatePlantSchema.parse(json);

    const plant = await updatePlant({
      userId: user.id,
      plantId,
      nickname: payload.nickname,
      wateringIntervalDays: payload.wateringIntervalDays,
      image: payload.image
    });

    return NextResponse.json({ plant });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ plantId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { plantId } = await context.params;
    const result = await deletePlant(user.id, plantId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
