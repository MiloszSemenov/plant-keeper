import { type Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { ApiError } from "@/lib/http";
import { addDays, endOfLocalDay, startOfLocalDay } from "@/lib/time";
import { savePlantImage } from "@/services/storage";
import {
  canManagePlants,
  ensureVaultEditor,
  ensureVaultMembership
} from "@/services/vaults";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const plantSpeciesSelect = {
  id: true,
  scientificName: true,
  normalizedLookupKey: true,
  defaultImageUrl: true,
  wateringIntervalDays: true,
  fertilizerIntervalDays: true,
  lightRequirement: true,
  soilType: true,
  petToxic: true,
  careNotes: true,
  source: true,
  createdAt: true,
  updatedAt: true
} as const;

export type DashboardSection = "overdue" | "today" | "upcoming";

function getEffectiveWateringIntervalDays(plant: {
  customWateringIntervalDays: number | null;
  species: {
    wateringIntervalDays: number;
  };
}) {
  return plant.customWateringIntervalDays ?? plant.species.wateringIntervalDays;
}

function splitDashboardPlants<T extends { nextWateringAt: Date }>(plants: T[], now: Date) {
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

function getRecentlyWateredPlants<T extends { lastWateredAt: Date | null }>(plants: T[]) {
  return plants
    .filter((plant) => plant.lastWateredAt)
    .sort((left, right) => {
      const leftValue = left.lastWateredAt?.getTime() ?? 0;
      const rightValue = right.lastWateredAt?.getTime() ?? 0;

      return rightValue - leftValue;
    })
    .slice(0, 5);
}

function getObservedWateringIntervalDays(events: Array<{ wateredAt: Date }>) {
  if (events.length < 3) {
    return null;
  }

  const intervals: number[] = [];

  for (let index = 0; index < events.length - 1; index += 1) {
    const newerEvent = events[index];
    const olderEvent = events[index + 1];
    const intervalDays = Math.max(
      1,
      Math.round((newerEvent.wateredAt.getTime() - olderEvent.wateredAt.getTime()) / DAY_IN_MS)
    );

    intervals.push(intervalDays);
  }

  if (intervals.length === 0) {
    return null;
  }

  const averageIntervalDays =
    intervals.reduce((total, intervalDays) => total + intervalDays, 0) / intervals.length;

  return Math.round(averageIntervalDays);
}

export async function getVaultPlants(userId: string, vaultId: string) {
  await ensureVaultMembership(userId, vaultId);

  return prisma.plant.findMany({
    where: {
      vaultId
    },
    include: {
      species: {
        select: plantSpeciesSelect
      }
    },
    orderBy: {
      nextWateringAt: "asc"
    }
  });
}

async function waterPlantWithRecord(
  tx: Prisma.TransactionClient,
  plant: {
    id: string;
    customWateringIntervalDays: number | null;
    species: {
      wateringIntervalDays: number;
    };
  },
  userId: string,
  wateredAt: Date
) {
  const wateringIntervalDays = getEffectiveWateringIntervalDays(plant);

  const updatedPlant = await tx.plant.update({
    where: {
      id: plant.id
    },
    data: {
      lastWateredAt: wateredAt,
      nextWateringAt: addDays(wateredAt, wateringIntervalDays)
    },
    include: {
      species: {
        select: plantSpeciesSelect
      },
      vault: true
    }
  });

  await tx.plantWateringEvent.create({
    data: {
      plantId: plant.id,
      wateredBy: userId,
      wateredAt
    }
  });

  await tx.activityLog.create({
    data: {
      vaultId: updatedPlant.vault.id,
      userId,
      actionType: "plant_watered",
      entityType: "plant",
      entityId: updatedPlant.id
    }
  });

  return updatedPlant;
}

export async function createPlant({
  userId,
  vaultId,
  speciesId,
  nickname,
  image
}: {
  userId: string;
  vaultId: string;
  speciesId: string;
  nickname?: string;
  image?: string;
}) {
  await ensureVaultEditor(userId, vaultId);

  const speciesRecord = await prisma.plantSpecies.findUnique({
    where: {
      id: speciesId
    },
    select: {
      id: true,
      scientificName: true,
      defaultImageUrl: true,
      wateringIntervalDays: true
    }
  });

  if (!speciesRecord) {
    throw new ApiError(400, "Select a plant species before saving");
  }

  const now = new Date();
  const imageUrl = image ? await savePlantImage(image) : speciesRecord.defaultImageUrl;
  const plantNickname = nickname?.trim() || speciesRecord.scientificName;

  return prisma.$transaction(async (tx) => {
    const plant = await tx.plant.create({
      data: {
        vaultId,
        speciesId: speciesRecord.id,
        nickname: plantNickname,
        imageUrl,
        lastWateredAt: now,
        nextWateringAt: addDays(now, speciesRecord.wateringIntervalDays)
      },
      include: {
        species: {
          select: plantSpeciesSelect
        },
        vault: true
      }
    });

    await tx.activityLog.create({
      data: {
        vaultId,
        userId,
        actionType: "plant_created",
        entityType: "plant",
        entityId: plant.id
      }
    });

    return plant;
  });
}

export async function getDashboard(
  userId: string,
  vaultId: string,
  options?: {
    now?: Date;
  }
) {
  const plants = await getVaultPlants(userId, vaultId);
  const now = options?.now ?? new Date();
  return {
    ...splitDashboardPlants(plants, now),
    recentlyWatered: getRecentlyWateredPlants(plants)
  };
}

export async function getPlantDetail(userId: string, plantId: string) {
  const plant = await prisma.plant.findUnique({
    where: {
      id: plantId
    },
    include: {
      species: {
        select: plantSpeciesSelect
      },
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

  const observedWateringIntervalDays = getObservedWateringIntervalDays(plant.wateringEvents);

  return {
    ...plant,
    viewerRole: viewerMembership.role,
    canEdit: canManagePlants(viewerMembership.role),
    wateringInsights: {
      recommendedIntervalDays: plant.species.wateringIntervalDays,
      observedIntervalDays: observedWateringIntervalDays,
      observedEventCount: plant.wateringEvents.length
    }
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
      species: {
        select: plantSpeciesSelect
      },
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
  const wateredAt = new Date();

  return prisma.$transaction((tx) => waterPlantWithRecord(tx, plant, userId, wateredAt));
}

export async function markDashboardSectionWatered(
  userId: string,
  vaultId: string,
  section: DashboardSection,
  options?: {
    now?: Date;
  }
) {
  const dashboard = await getDashboard(userId, vaultId, options);
  const plantsToWater = dashboard[section];
  const wateredAt = options?.now ?? new Date();

  if (plantsToWater.length === 0) {
    return {
      section,
      updatedCount: 0,
      plants: []
    };
  }

  const plants = await prisma.$transaction(async (tx) => {
    const updatedPlants = [];

    for (const plant of plantsToWater) {
      updatedPlants.push(await waterPlantWithRecord(tx, plant, userId, wateredAt));
    }

    return updatedPlants;
  });

  return {
    section,
    updatedCount: plants.length,
    plants
  };
}
