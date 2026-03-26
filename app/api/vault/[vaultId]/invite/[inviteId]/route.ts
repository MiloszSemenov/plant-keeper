import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { removeOrInvalidateVaultInvite } from "@/services/invites";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ vaultId: string; inviteId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId, inviteId } = await context.params;
    const result = await removeOrInvalidateVaultInvite({
      actingUserId: user.id,
      vaultId,
      inviteId
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
