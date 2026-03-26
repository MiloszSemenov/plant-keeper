import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http";
import { declineVaultInvite } from "@/services/invites";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const vault = await declineVaultInvite({ token });
    return NextResponse.json({ vault });
  } catch (error) {
    return toErrorResponse(error);
  }
}
