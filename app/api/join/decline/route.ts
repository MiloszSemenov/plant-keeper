import { NextRequest, NextResponse } from "next/server";
import { toErrorResponse } from "@/lib/http";
import { joinSpaceSchema } from "@/lib/validators";
import { declineVaultInviteByCode } from "@/services/invites";

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const payload = joinSpaceSchema.parse(json);
    const vault = await declineVaultInviteByCode({
      code: payload.code
    });

    return NextResponse.json({ vault });
  } catch (error) {
    return toErrorResponse(error);
  }
}
