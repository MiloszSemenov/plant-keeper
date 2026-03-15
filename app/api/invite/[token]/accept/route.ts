import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { acceptVaultInvite } from "@/services/invites";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const user = await requireApiUser();
    const { token } = await context.params;
    const vault = await acceptVaultInvite({
      token,
      userId: user.id
    });

    return NextResponse.json({ vault });
  } catch (error) {
    return toErrorResponse(error);
  }
}
