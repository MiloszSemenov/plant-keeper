import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { notificationSettingSchema } from "@/lib/validators";
import { upsertVaultNotificationSetting } from "@/services/notifications";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ vaultId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { vaultId } = await context.params;
    const json = await request.json();
    const payload = notificationSettingSchema.parse(json);
    const setting = await upsertVaultNotificationSetting({
      userId: user.id,
      vaultId,
      emailEnabled: payload.emailEnabled,
      pushEnabled: payload.pushEnabled
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return toErrorResponse(error);
  }
}
