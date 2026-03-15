import { prisma } from "@/db/client";
import { ApiError } from "@/lib/http";
import { ensureVaultMembership } from "@/services/vaults";

export async function upsertVaultNotificationSetting({
  userId,
  vaultId,
  emailEnabled,
  pushEnabled
}: {
  userId: string;
  vaultId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
}) {
  await ensureVaultMembership(userId, vaultId);

  return prisma.notificationSetting.upsert({
    where: {
      userId_vaultId: {
        userId,
        vaultId
      }
    },
    update: {
      emailEnabled,
      pushEnabled
    },
    create: {
      userId,
      vaultId,
      emailEnabled,
      pushEnabled
    }
  });
}

export async function upsertPlantNotificationSetting({
  userId,
  plantId,
  emailEnabled,
  pushEnabled
}: {
  userId: string;
  plantId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
}) {
  const plant = await prisma.plant.findUnique({
    where: {
      id: plantId
    },
    select: {
      id: true,
      vaultId: true
    }
  });

  if (!plant) {
    throw new ApiError(404, "Plant not found");
  }

  await ensureVaultMembership(userId, plant.vaultId);

  return prisma.notificationSetting.upsert({
    where: {
      userId_plantId: {
        userId,
        plantId
      }
    },
    update: {
      emailEnabled,
      pushEnabled
    },
    create: {
      userId,
      plantId,
      emailEnabled,
      pushEnabled
    }
  });
}
