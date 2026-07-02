import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { ApiError, toErrorResponse } from "@/lib/http";
import { updateVaultSchema } from "@/lib/validators";
import {
  deleteOrLeaveVault,
  updateVaultCoverImage,
  updateVaultName
} from "@/services/vaults";
import { savePlantImage } from "@/services/storage";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId } = await context.params;
    const json = await request.json();
    const payload = updateVaultSchema.parse(json);

    // Cover image: upload a new one, or clear it to fall back to a random plant.
    if (payload.coverImage !== undefined || payload.removeCoverImage) {
      const coverImageUrl = payload.coverImage
        ? await savePlantImage(payload.coverImage)
        : null;
      const vault = await updateVaultCoverImage({
        actingUserId: user.id,
        vaultId,
        coverImageUrl
      });

      return NextResponse.json({ vault });
    }

    if (payload.name === undefined) {
      throw new ApiError(400, "Nothing to update");
    }

    const vault = await updateVaultName({
      actingUserId: user.id,
      vaultId,
      name: payload.name
    });

    return NextResponse.json({ vault });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId } = await context.params;
    const result = await deleteOrLeaveVault(user.id, vaultId);
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
