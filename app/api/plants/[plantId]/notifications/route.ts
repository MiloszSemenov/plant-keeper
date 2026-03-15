import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth-helpers";
import { toErrorResponse } from "@/lib/http";
import { notificationSettingSchema } from "@/lib/validators";
import { upsertPlantNotificationSetting } from "@/services/notifications";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ plantId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { plantId } = await context.params;
    const json = await request.json();
    const payload = notificationSettingSchema.parse(json);
    const setting = await upsertPlantNotificationSetting({
      userId: user.id,
      plantId,
      emailEnabled: payload.emailEnabled,
      pushEnabled: payload.pushEnabled
    });

    return NextResponse.json({ setting });
  } catch (error) {
    return toErrorResponse(error);
  }
}
