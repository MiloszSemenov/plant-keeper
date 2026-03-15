import { prisma } from "@/db/client";
import { ApiError } from "@/lib/http";
import { addDays, endOfLocalDay, startOfLocalDay } from "@/lib/time";
import { getOrCreatePlantSpecies } from "@/services/plant-care";
import { savePlantImage } from "@/services/storage";
import {
  canManagePlants,
  ensureVaultEditor,
  ensureVaultMembership
} from "@/services/vaults";

function getEffectiveWateringIntervalDays(plant: {
  customWateringIntervalDays: number | null;
  species: {
    wateringIntervalDays: number;
  };
}) {
  return plant.customWateringIntervalDays ?? plant.species.wateringIntervalDays;
}

export async function createPlant({
  userId,
  vaultId,
  species,
  nickname,
  image
}: {
  userId: string;
  vaultId: string;
  species: string;
  nickname?: string;
  image?: string;
}) {
  await ensureVaultEditor(userId, vaultId);

  const speciesRecord = await getOrCreatePlantSpecies(species);
  const now = new Date();
  const imageUrl = image ? await savePlantImage(image) : null;
  const plantNickname = nickname?.trim() || speciesRecord.scientificName;

  return prisma.plant.create({
    data: {
      vaultId,
      speciesId: speciesRecord.id,
      nickname: plantNickname,
      imageUrl,
      lastWateredAt: now,
      nextWateringAt: addDays(now, speciesRecord.wateringIntervalDays)
    },
    include: {
      species: true,
      vault: true
    }
  });
}

export async function getDashboard(
  userId: string,
  vaultId: string,
  options?: {
    now?: Date;
  }
) {
  await ensureVaultMembership(userId, vaultId);

  const plants = await prisma.plant.findMany({
    where: {
      vaultId
    },
    include: {
      species: true
    },
    orderBy: {
      nextWateringAt: "asc"
    }
  });

  const now = options?.now ?? new Date();
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  return {
    overdue: plants.filter((plant) => plant.nextWateringAt < todayStart),
    today: plants.filter(
      (plant) => plant.nextWateringAt >= todayStart && plant.nextWateringAt <= todayEnd
    ),
    upcoming: plants.filter((plant) => plant.nextWateringAt > todayEnd)
  };
}

export async function getPlantDetail(userId: string, plantId: string) {
  const plant = await prisma.plant.findUnique({
    where: {
      id: plantId
    },
    include: {
      species: true,
      notificationSettings: {
        where: {
          userId
        },
        take: 1
      },
      vault: {
        include: {
          memberships: {
            include: {
              user: true
            }
          },
          notificationSettings: {
            where: {
              userId
            },
            take: 1
          }
        }
      },
      wateringEvents: {
        include: {
          user: true
        },
        orderBy: {
          wateredAt: "desc"
        },
        take: 10
      }
    }
  });

  if (!plant) {
    throw new ApiError(404, "Plant not found");
  }

  const viewerMembership = plant.vault.memberships.find((membership) => membership.userId === userId);

  if (!viewerMembership) {
    throw new ApiError(403, "You do not have access to this plant");
  }

  return {
    ...plant,
    viewerRole: viewerMembership.role,
    canEdit: canManagePlants(viewerMembership.role)
  };
}

export async function updatePlant({
  userId,
  plantId,
  nickname,
  wateringIntervalDays,
  image
}: {
  userId: string;
  plantId: string;
  nickname: string;
  wateringIntervalDays: number;
  image?: string;
}) {
  const plant = await getPlantDetail(userId, plantId);
  await ensureVaultEditor(userId, plant.vaultId);

  const customWateringIntervalDays =
    wateringIntervalDays === plant.species.wateringIntervalDays ? null : wateringIntervalDays;
  const baseDate = plant.lastWateredAt ?? new Date();
  const nextWateringAt = addDays(baseDate, wateringIntervalDays);
  const imageUrl = image ? await savePlantImage(image) : plant.imageUrl;

  return prisma.plant.update({
    where: {
      id: plant.id
    },
    data: {
      nickname: nickname.trim(),
      imageUrl,
      customWateringIntervalDays,
      nextWateringAt
    },
    include: {
      species: true,
      vault: true
    }
  });
}

export async function deletePlant(userId: string, plantId: string) {
  const plant = await getPlantDetail(userId, plantId);
  await ensureVaultEditor(userId, plant.vaultId);

  await prisma.plant.delete({
    where: {
      id: plant.id
    }
  });

  return {
    deleted: true,
    vaultId: plant.vaultId
  };
}

export async function markPlantWatered(userId: string, plantId: string) {
  const plant = await getPlantDetail(userId, plantId);
  const now = new Date();
  const wateringIntervalDays = getEffectiveWateringIntervalDays(plant);

  return prisma.$transaction(async (tx) => {
    const updatedPlant = await tx.plant.update({
      where: {
        id: plant.id
      },
      data: {
        lastWateredAt: now,
        nextWateringAt: addDays(now, wateringIntervalDays)
      },
      include: {
        species: true,
        vault: true
      }
    });

    await tx.plantWateringEvent.create({
      data: {
        plantId: plant.id,
        wateredBy: userId,
        wateredAt: now
      }
    });

    return updatedPlant;
  });
}
