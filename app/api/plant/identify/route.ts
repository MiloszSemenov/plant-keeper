import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { identifyPlantFromImage } from "@/services/plant-id";
import {
  assertPhotoIdentificationQuota,
  recordPhotoIdentification
} from "@/services/usage";
import { requireApiUser } from "@/lib/auth-helpers";
import { normalizeBase64Image } from "@/lib/base64";
import { toErrorResponse } from "@/lib/http";
import { identifyPlantSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const json = await request.json();
    const payload = identifyPlantSchema.parse(json);

    const { content } = normalizeBase64Image(payload.image);
    const imageHash = createHash("sha256").update(content).digest("hex");

    const cached = await prisma.plantIdentificationCache.findUnique({
      where: { imageHash }
    });

    if (cached) {
      return NextResponse.json({ suggestions: cached.suggestions });
    }

    await assertPhotoIdentificationQuota(user.id);

    const suggestions = await identifyPlantFromImage(payload.image);

    await Promise.all([
      recordPhotoIdentification(user.id),
      prisma.plantIdentificationCache
        .create({
          data: {
            imageHash,
            suggestions: suggestions as unknown as Prisma.InputJsonValue
          }
        })
        // a concurrent request may have cached the same image first
        .catch(() => undefined)
    ]);

    return NextResponse.json({ suggestions });
  } catch (error) {
    return toErrorResponse(error);
  }
}
