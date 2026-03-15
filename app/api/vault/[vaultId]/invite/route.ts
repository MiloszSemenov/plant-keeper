import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { createInviteSchema } from "@/lib/validators";
import { createVaultInvite } from "@/services/invites";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId } = await context.params;
    const json = await request.json();
    const payload = createInviteSchema.parse(json);
    const result = await createVaultInvite({
      vaultId,
      userId: user.id,
      email: payload.email || undefined
    });

    return NextResponse.json({
      token: result.invite.token,
      code: result.invite.code,
      inviteUrl: result.inviteUrl,
      joinUrl: result.joinUrl,
      expiresAt: result.invite.expiresAt
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
