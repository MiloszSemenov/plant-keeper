import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { markPlantWatered } from "@/services/plants";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ plantId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { plantId } = await context.params;
    const plant = await markPlantWatered(user.id, plantId);
    return NextResponse.json({ plant });
  } catch (error) {
    return toErrorResponse(error);
  }
}
