import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { vaultMemberRoleSchema } from "@/lib/validators";
import { removeVaultMember, updateVaultMemberRole } from "@/services/vaults";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ vaultId: string; memberId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId, memberId } = await context.params;
    const json = await request.json();
    const payload = vaultMemberRoleSchema.parse(json);
    const membership = await updateVaultMemberRole({
      actingUserId: user.id,
      vaultId,
      memberId,
      role: payload.role
    });

    return NextResponse.json({ membership });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ vaultId: string; memberId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId, memberId } = await context.params;
    const result = await removeVaultMember({
      actingUserId: user.id,
      vaultId,
      memberId
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
