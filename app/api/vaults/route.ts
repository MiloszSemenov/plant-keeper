import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { createVaultSchema } from "@/lib/validators";
import { createVault, listUserVaults } from "@/services/vaults";

export async function GET() {
  try {
    const user = await requireApiUser();
    const memberships = await listUserVaults(user.id);
    return NextResponse.json({
      vaults: memberships.map((membership) => ({
        id: membership.vault.id,
        name: membership.vault.name,
        role: membership.role,
        memberCount: membership.vault._count.memberships,
        plantCount: membership.vault._count.plants
      }))
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireApiUser();
    const json = await request.json();
    const payload = createVaultSchema.parse(json);
    const vault = await createVault(user.id, payload.name);
    return NextResponse.json({ vault }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
