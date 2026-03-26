import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { deleteOrLeaveVault } from "@/services/vaults";

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
