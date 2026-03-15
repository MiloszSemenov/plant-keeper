import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { joinSpaceSchema } from "@/lib/validators";
import { acceptVaultInviteByCode } from "@/services/invites";

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const json = await request.json();
    const payload = joinSpaceSchema.parse(json);
    const vault = await acceptVaultInviteByCode({
      code: payload.code,
      userId: user.id
    });

    return NextResponse.json({ vault });
  } catch (error) {
    return toErrorResponse(error);
  }
}
