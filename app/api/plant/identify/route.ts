import { NextRequest, NextResponse } from "next/server";
import { identifyPlantFromImage } from "@/services/plant-id";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { identifyPlantSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    await requireApiUser();
    const json = await request.json();
    const payload = identifyPlantSchema.parse(json);
    const suggestions = await identifyPlantFromImage(payload.image);
    return NextResponse.json({ suggestions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
