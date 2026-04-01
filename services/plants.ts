import {
  access,
  copyFile,
  mkdir,
  readdir,
  unlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { type Prisma } from '@prisma/client';
import { prisma } from '@/db/client';
import { extensionFromMime } from '@/lib/base64';
import { ApiError } from '@/lib/http';
import { resolvePlantImage } from '@/lib/plant-image';
import {
  isSupportedPlantImageMimeType,
  MAX_PLANT_IMAGE_BYTES,
} from '@/lib/image-upload';
import { normalizePlantLookupKey } from '@/lib/plants';
import { addDays, endOfLocalDay, startOfLocalDay } from '@/lib/time';
import { savePlantImage, saveRemotePlantImage } from '@/services/storage';
import {
  canManagePlants,
  ensureVaultEditor,
  ensureVaultMembership,
} from '@/services/vaults';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SPECIES_IMAGE_DIRECTORY = path.join(process.cwd(), 'public', 'species');
const speciesImageDownloads = new Map<string, Promise<string | null>>();

const plantSpeciesSelect = {
  id: true,
  scientificName: true,
  normalizedLookupKey: true,
  defaultImageUrl: true,
  wikipediaImageUrl: true,
  wateringIntervalDays: true,
  fertilizerIntervalDays: true,
  lightRequirement: true,
  soilType: true,
  petToxic: true,
  careNotes: true,
  source: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type DashboardSection = 'overdue' | 'today' | 'upcoming';

function getEffectiveWateringIntervalDays(plant: {
  customWateringIntervalDays: number | null;
  species: {
    wateringIntervalDays: number;
  };
}) {
  return plant.customWateringIntervalDays ?? plant.species.wateringIntervalDays;
}

function splitDashboardPlants<T extends { nextWateringAt: Date }>(
  plants: T[],
  now: Date,
) {
  const todayStart = startOfLocalDay(now);
  const todayEnd = endOfLocalDay(now);

  return {
    overdue: plants.filter((plant) => plant.nextWateringAt < todayStart),
    today: plants.filter(
      (plant) =>
        plant.nextWateringAt >= todayStart && plant.nextWateringAt <= todayEnd,
    ),
    upcoming: plants.filter((plant) => plant.nextWateringAt > todayEnd),
  };
}

function getRecentlyWateredPlants<T extends { lastWateredAt: Date | null }>(
  plants: T[],
) {
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
      Math.round(
        (newerEvent.wateredAt.getTime() - olderEvent.wateredAt.getTime()) /
          DAY_IN_MS,
      ),
    );

    intervals.push(intervalDays);
  }

  if (intervals.length === 0) {
    return null;
  }

  const averageIntervalDays =
    intervals.reduce((total, intervalDays) => total + intervalDays, 0) /
    intervals.length;

  return Math.round(averageIntervalDays);
}

function getDisplayPlantImageUrl(plant: {
  imageUrl: string | null;
  species: {
    defaultImageUrl: string | null;
  };
}) {
  return resolvePlantImage({
    context: 'plant',
    plantImageUrl: isLocalPublicImageUrl(plant.imageUrl) ? plant.imageUrl : null,
    speciesDefaultImageUrl: isLocalPublicImageUrl(plant.species.defaultImageUrl)
      ? plant.species.defaultImageUrl
      : null,
  });
}

function isLocalPublicImageUrl(imageUrl: string | null | undefined) {
  return typeof imageUrl === 'string' && imageUrl.startsWith('/');
}

export function isStoredSpeciesImageUrl(imageUrl: string | null | undefined) {
  return (
    typeof imageUrl === 'string' &&
    (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('/species/'))
  );
}

function isRemoteImageUrl(imageUrl: string | null | undefined) {
  return typeof imageUrl === 'string' && imageUrl.trim().length > 0 && !imageUrl.startsWith('/');
}

function getSpeciesWikipediaFallbackUrl(species: {
  defaultImageUrl?: string | null;
  wikipediaImageUrl?: string | null;
}) {
  if (isRemoteImageUrl(species.wikipediaImageUrl)) {
    return species.wikipediaImageUrl;
  }

  return isRemoteImageUrl(species.defaultImageUrl) &&
    !isStoredSpeciesImageUrl(species.defaultImageUrl)
    ? species.defaultImageUrl
    : null;
}

function getSpeciesImageDownloadKey(speciesName: string) {
  return normalizePlantLookupKey(speciesName) || speciesName.trim().toLowerCase();
}

function getPublicAssetPath(relativeUrl: string) {
  return path.join(
    process.cwd(),
    'public',
    ...relativeUrl.replace(/^\/+/, '').split('/'),
  );
}

function normalizeImageExtension(extension: string) {
  if (extension === 'jpeg') {
    return 'jpg';
  }

  if (extension === 'heif') {
    return 'heic';
  }

  return extension;
}

function isSupportedStoredImageExtension(extension: string) {
  return ['jpg', 'png', 'webp', 'heic'].includes(
    normalizeImageExtension(extension),
  );
}

async function clearExistingSpeciesImages(speciesId: string) {
  const existingFiles = await readdir(SPECIES_IMAGE_DIRECTORY).catch(() => []);

  await Promise.all(
    existingFiles
      .filter((fileName) => fileName.startsWith(`${speciesId}.`))
      .map((fileName) =>
        unlink(path.join(SPECIES_IMAGE_DIRECTORY, fileName)).catch(() => null),
      ),
  );
}

async function copySpeciesImageFromLocalPath(
  imageUrl: string,
  speciesId: string,
) {
  const sourcePath = getPublicAssetPath(imageUrl);
  const extension = normalizeImageExtension(
    path.extname(sourcePath).replace(/^\./, '').toLowerCase(),
  );

  if (!extension || !isSupportedStoredImageExtension(extension)) {
    throw new ApiError(400, 'Unsupported plant image format');
  }

  await access(sourcePath);
  await mkdir(SPECIES_IMAGE_DIRECTORY, { recursive: true });
  await clearExistingSpeciesImages(speciesId);

  const fileName = `${speciesId}.${extension}`;
  const destinationPath = path.join(SPECIES_IMAGE_DIRECTORY, fileName);

  await copyFile(sourcePath, destinationPath);

  return `/species/${fileName}`;
}

export async function downloadSpeciesImage(
  imageUrl: string,
  speciesId: string,
) {
  console.info('[species] download_start', {
    speciesId,
    imageUrl,
  });
  const response = await fetch(imageUrl);

  if (!response.ok) {
    throw new ApiError(502, 'Unable to download species image');
  }

  const contentType = response.headers
    .get('content-type')
    ?.split(';')[0]
    ?.trim()
    .toLowerCase();

  console.info('[species] download_response', {
    speciesId,
    imageUrl,
    contentType: contentType ?? null,
  });

  if (!contentType || !isSupportedPlantImageMimeType(contentType)) {
    throw new ApiError(400, 'Unsupported plant image format');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (buffer.byteLength === 0 || buffer.byteLength > MAX_PLANT_IMAGE_BYTES) {
    throw new ApiError(400, 'Image must be smaller than 5 MB');
  }

  const extension = normalizeImageExtension(extensionFromMime(contentType));

  await mkdir(SPECIES_IMAGE_DIRECTORY, { recursive: true });
  await clearExistingSpeciesImages(speciesId);

  const fileName = `${speciesId}.${extension}`;
  const outputPath = path.join(SPECIES_IMAGE_DIRECTORY, fileName);

  await writeFile(outputPath, buffer);

  console.info('[species] download_saved', {
    speciesId,
    imageUrl,
    outputPath,
    relativePath: `/species/${fileName}`,
  });

  return `/species/${fileName}`;
}

export async function findSpeciesWikipediaImage(scientificName: string) {
  const searchEndpoint = new URL(
    'https://en.wikipedia.org/w/rest.php/v1/search/page',
  );
  searchEndpoint.searchParams.set('q', scientificName);
  searchEndpoint.searchParams.set('limit', '1');

  try {
    const response = await fetch(searchEndpoint, {
      headers: {
        'User-Agent': 'PlantKeeper/1.0 (development)',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      pages?: Array<{
        title?: string;
      }>;
    };
    const pages = Array.isArray(payload.pages) ? payload.pages : [];
    const title = pages[0]?.title ?? null;

    console.info('[wiki] search_result', {
      scientificName,
      resultTitle: title,
    });

    if (!title) {
      console.info('[wiki] image_result', {
        scientificName,
        imageUrl: null,
      });

      return null;
    }

    const imageEndpoint = new URL('https://en.wikipedia.org/w/api.php');
    imageEndpoint.searchParams.set('action', 'query');
    imageEndpoint.searchParams.set('titles', title);
    imageEndpoint.searchParams.set('prop', 'pageimages');
    imageEndpoint.searchParams.set('format', 'json');
    imageEndpoint.searchParams.set('pithumbsize', '500');

    const imageResponse = await fetch(imageEndpoint, {
      headers: {
        'User-Agent': 'PlantKeeper/1.0 (development)',
      },
    });

    if (!imageResponse.ok) {
      console.info('[wiki] image_result', {
        scientificName,
        imageUrl: null,
      });

      return null;
    }

    const imagePayload = (await imageResponse.json()) as {
      query?: {
        pages?: Record<
          string,
          {
            thumbnail?: {
              source?: string;
            };
          }
        >;
      };
    };
    const page = Object.values(imagePayload.query?.pages ?? {})[0];
    const url = page?.thumbnail?.source ?? null;

    console.info('[wiki] image_result', {
      scientificName,
      imageUrl: url,
    });

    if (!url) {
      return null;
    }

    return url.startsWith('//') ? `https:${url}` : url;
  } catch (error) {
    console.error('[wiki] search_failed', {
      scientificName,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return null;
  }
}

export async function persistSpeciesDefaultImage(
  speciesId: string,
  imageUrl: string | null,
) {
  const species = await prisma.plantSpecies.findUnique({
    where: {
      id: speciesId,
    },
    select: {
      defaultImageUrl: true,
      wikipediaImageUrl: true,
    },
  });

  if (!species) {
    throw new ApiError(404, 'Plant species not found');
  }

  console.info('[species] persist_default_image_start', {
    speciesId,
    incomingImageUrl: imageUrl ?? null,
    existingDefaultImageUrl: species.defaultImageUrl ?? null,
  });

  if (isStoredSpeciesImageUrl(species.defaultImageUrl)) {
    console.info('[species] persist_default_image_skip', {
      speciesId,
      reason: 'already_stored',
      defaultImageUrl: species.defaultImageUrl,
    });

    return species.defaultImageUrl;
  }

  const sourceImageUrl =
    imageUrl ?? getSpeciesWikipediaFallbackUrl(species) ?? species.defaultImageUrl;

  if (!sourceImageUrl) {
    console.info('[species] persist_default_image_skip', {
      speciesId,
      reason: 'missing_source_image',
    });

    return null;
  }

  try {
    const storageMode = isLocalPublicImageUrl(sourceImageUrl)
      ? isStoredSpeciesImageUrl(sourceImageUrl)
        ? 'reuse_stored'
        : 'reuse_local_public'
      : 'download_remote';

    console.info('[species] persist_default_image_store', {
      speciesId,
      sourceImageUrl,
      storageMode,
    });

    const storedImageUrl = isLocalPublicImageUrl(sourceImageUrl)
      ? sourceImageUrl
      : await saveRemotePlantImage(sourceImageUrl);
    const wikipediaImageUrl = isRemoteImageUrl(sourceImageUrl)
      ? sourceImageUrl
      : getSpeciesWikipediaFallbackUrl(species);

    await prisma.plantSpecies.update({
      where: {
        id: speciesId,
      },
      data: {
        defaultImageUrl: storedImageUrl,
        wikipediaImageUrl,
      },
    });

    console.info('[species] default_image_db_updated', {
      speciesId,
      defaultImageUrl: storedImageUrl,
    });

    return storedImageUrl;
  } catch (error) {
    console.error('[plants] default_image_upload_failed', {
      speciesId,
      imageUrl,
      error: error instanceof Error ? error.message : 'unknown_error',
    });

    return null;
  }
}

export async function persistSpeciesWikipediaImage(
  speciesId: string,
  wikipediaImageUrl: string | null,
) {
  if (typeof wikipediaImageUrl !== 'string') {
    return null;
  }

  const normalizedWikipediaImageUrl = wikipediaImageUrl.trim();

  if (
    normalizedWikipediaImageUrl.length === 0 ||
    normalizedWikipediaImageUrl.startsWith('/')
  ) {
    return null;
  }
  const species = await prisma.plantSpecies.findUnique({
    where: {
      id: speciesId,
    },
    select: {
      wikipediaImageUrl: true,
    },
  });

  if (!species) {
    return null;
  }

  if (species.wikipediaImageUrl === normalizedWikipediaImageUrl) {
    return species.wikipediaImageUrl;
  }

  await prisma.plantSpecies.update({
    where: {
      id: speciesId,
    },
    data: {
      wikipediaImageUrl: normalizedWikipediaImageUrl,
    },
  });

  return normalizedWikipediaImageUrl;
}

export async function downloadAndSaveSpeciesImage(
  speciesName: string,
  wikipediaImageUrl: string,
) {
  const downloadKey = getSpeciesImageDownloadKey(speciesName);
  const existingTask = speciesImageDownloads.get(downloadKey);

  if (existingTask) {
    return existingTask;
  }

  const task = (async () => {
    const normalizedLookupKey = normalizePlantLookupKey(speciesName);

    if (!normalizedLookupKey) {
      return null;
    }

    const species = await prisma.plantSpecies.findUnique({
      where: {
        normalizedLookupKey,
      },
      select: {
        id: true,
        defaultImageUrl: true,
        wikipediaImageUrl: true,
      },
    });

    if (!species) {
      return null;
    }

    if (isStoredSpeciesImageUrl(species.defaultImageUrl)) {
      return species.defaultImageUrl;
    }

    const sourceImageUrl =
      wikipediaImageUrl ?? getSpeciesWikipediaFallbackUrl(species);

    if (!sourceImageUrl) {
      return null;
    }

    const persistedWikipediaImageUrl = await persistSpeciesWikipediaImage(
      species.id,
      sourceImageUrl,
    );

    return persistSpeciesDefaultImage(
      species.id,
      persistedWikipediaImageUrl ?? sourceImageUrl,
    );
  })().finally(() => {
    speciesImageDownloads.delete(downloadKey);
  });

  speciesImageDownloads.set(downloadKey, task);
  return task;
}

export function triggerSpeciesImageDownload(
  speciesName: string,
  wikipediaImageUrl: string | null | undefined,
) {
  if (typeof wikipediaImageUrl !== 'string') {
    return;
  }

  const normalizedWikipediaImageUrl = wikipediaImageUrl.trim();

  if (
    normalizedWikipediaImageUrl.length === 0 ||
    normalizedWikipediaImageUrl.startsWith('/')
  ) {
    return;
  }

  void downloadAndSaveSpeciesImage(
    speciesName,
    normalizedWikipediaImageUrl,
  ).catch((error) => {
    console.error('[species] background_download_failed', {
      speciesName,
      wikipediaImageUrl: normalizedWikipediaImageUrl,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  });
}

export async function ensureSpeciesDefaultImage(
  speciesId: string,
  imageUrl?: string | null,
) {
  const species = await prisma.plantSpecies.findUnique({
    where: {
      id: speciesId,
    },
    select: {
      id: true,
      scientificName: true,
      defaultImageUrl: true,
      wikipediaImageUrl: true,
    },
  });

  if (!species) {
    throw new ApiError(404, 'Plant species not found');
  }

  console.info('[species] ensure_default_image_start', {
    speciesId,
    incomingImageUrl: imageUrl ?? null,
    existingDefaultImageUrl: species.defaultImageUrl ?? null,
  });

  if (isStoredSpeciesImageUrl(species.defaultImageUrl)) {
    console.info('[species] ensure_default_image_skip', {
      speciesId,
      downloadTriggered: false,
      reason: 'already_stored',
      defaultImageUrl: species.defaultImageUrl,
    });

    return species.defaultImageUrl;
  }

  let preferredImageUrl =
    imageUrl ?? getSpeciesWikipediaFallbackUrl(species);

  if (preferredImageUrl) {
    console.info('[species] ensure_default_image_persist', {
      speciesId,
      downloadTriggered: true,
      preferredImageUrl,
      reason: imageUrl ? 'incoming_image_url' : 'existing_default_image_url',
    });

    const storedImageUrl = isLocalPublicImageUrl(preferredImageUrl)
      ? await persistSpeciesDefaultImage(species.id, preferredImageUrl)
      : await downloadAndSaveSpeciesImage(
          species.scientificName,
          preferredImageUrl,
        );

    console.info('[species] ensure_default_image_result', {
      speciesId,
      storedImageUrl: storedImageUrl ?? null,
    });

    return storedImageUrl;
  }

  const wikipediaImageUrl = await findSpeciesWikipediaImage(
    species.scientificName,
  );
  const candidateImageUrl = wikipediaImageUrl;

  console.info('[species] ensure_default_image_search_result', {
    speciesId,
    scientificName: species.scientificName,
    wikipediaImageUrl,
    candidateImageUrl: candidateImageUrl ?? null,
    downloadTriggered: Boolean(candidateImageUrl),
  });

  if (candidateImageUrl) {
    await persistSpeciesWikipediaImage(species.id, candidateImageUrl);
  }

  const storedImageUrl = candidateImageUrl
    ? await downloadAndSaveSpeciesImage(
        species.scientificName,
        candidateImageUrl,
      )
    : null;

  console.info('[species] ensure_default_image_result', {
    speciesId,
    storedImageUrl: storedImageUrl ?? null,
  });

  return storedImageUrl;
}

export async function getVaultPlants(userId: string, vaultId: string) {
  await ensureVaultMembership(userId, vaultId);

  const plants = await prisma.plant.findMany({
    where: {
      vaultId,
    },
    include: {
      species: {
        select: plantSpeciesSelect,
      },
    },
    orderBy: {
      nextWateringAt: 'asc',
    },
  });

  return plants.map((plant) => ({
    ...plant,
    imageUrl: getDisplayPlantImageUrl(plant),
  }));
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
  wateredAt: Date,
) {
  const wateringIntervalDays = getEffectiveWateringIntervalDays(plant);

  const updatedPlant = await tx.plant.update({
    where: {
      id: plant.id,
    },
    data: {
      lastWateredAt: wateredAt,
      nextWateringAt: addDays(wateredAt, wateringIntervalDays),
    },
    include: {
      species: {
        select: plantSpeciesSelect,
      },
      vault: true,
    },
  });

  await tx.plantWateringEvent.create({
    data: {
      plantId: plant.id,
      wateredBy: userId,
      wateredAt,
    },
  });

  await tx.activityLog.create({
    data: {
      vaultId: updatedPlant.vault.id,
      userId,
      actionType: 'plant_watered',
      entityType: 'plant',
      entityId: updatedPlant.id,
    },
  });

  return updatedPlant;
}

export async function createPlant({
  userId,
  vaultId,
  speciesId,
  nickname,
  image,
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
      id: speciesId,
    },
    select: {
      id: true,
      scientificName: true,
      defaultImageUrl: true,
      wateringIntervalDays: true,
    },
  });

  if (!speciesRecord) {
    throw new ApiError(400, 'Select a plant species before saving');
  }

  const now = new Date();
  const speciesDefaultImageUrl = await ensureSpeciesDefaultImage(
    speciesRecord.id,
  );
  const imageUrl = image ? await savePlantImage(image) : speciesDefaultImageUrl;
  const plantNickname = nickname?.trim() || speciesRecord.scientificName;

  return prisma.$transaction(async (tx) => {
    const plant = await tx.plant.create({
      data: {
        vaultId,
        speciesId: speciesRecord.id,
        nickname: plantNickname,
        imageUrl,
        lastWateredAt: now,
        nextWateringAt: addDays(now, speciesRecord.wateringIntervalDays),
      },
      include: {
        species: {
          select: plantSpeciesSelect,
        },
        vault: true,
      },
    });

    await tx.activityLog.create({
      data: {
        vaultId,
        userId,
        actionType: 'plant_created',
        entityType: 'plant',
        entityId: plant.id,
      },
    });

    return plant;
  });
}

export async function getDashboard(
  userId: string,
  vaultId: string,
  options?: {
    now?: Date;
  },
) {
  const plants = await getVaultPlants(userId, vaultId);
  const now = options?.now ?? new Date();
  return {
    ...splitDashboardPlants(plants, now),
    recentlyWatered: getRecentlyWateredPlants(plants),
  };
}

export async function getPlantDetail(userId: string, plantId: string) {
  const plant = await prisma.plant.findUnique({
    where: {
      id: plantId,
    },
    include: {
      species: {
        select: plantSpeciesSelect,
      },
      notificationSettings: {
        where: {
          userId,
        },
        take: 1,
      },
      vault: {
        include: {
          memberships: {
            include: {
              user: true,
            },
          },
          notificationSettings: {
            where: {
              userId,
            },
            take: 1,
          },
        },
      },
      wateringEvents: {
        include: {
          user: true,
        },
        orderBy: {
          wateredAt: 'desc',
        },
        take: 10,
      },
    },
  });

  if (!plant) {
    throw new ApiError(404, 'Plant not found');
  }

  const viewerMembership = plant.vault.memberships.find(
    (membership) => membership.userId === userId,
  );

  if (!viewerMembership) {
    throw new ApiError(403, 'You do not have access to this plant');
  }

  const observedWateringIntervalDays = getObservedWateringIntervalDays(
    plant.wateringEvents,
  );

  return {
    ...plant,
    imageUrl: getDisplayPlantImageUrl(plant),
    viewerRole: viewerMembership.role,
    canEdit: canManagePlants(viewerMembership.role),
    wateringInsights: {
      recommendedIntervalDays: plant.species.wateringIntervalDays,
      observedIntervalDays: observedWateringIntervalDays,
      observedEventCount: plant.wateringEvents.length,
    },
  };
}

export async function updatePlant({
  userId,
  plantId,
  nickname,
  wateringIntervalDays,
  image,
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
    wateringIntervalDays === plant.species.wateringIntervalDays
      ? null
      : wateringIntervalDays;
  const baseDate = plant.lastWateredAt ?? new Date();
  const nextWateringAt = addDays(baseDate, wateringIntervalDays);
  const imageUrl = image ? await savePlantImage(image) : undefined;

  return prisma.plant.update({
    where: {
      id: plant.id,
    },
    data: {
      nickname: nickname.trim(),
      ...(imageUrl ? { imageUrl } : {}),
      customWateringIntervalDays,
      nextWateringAt,
    },
    include: {
      species: {
        select: plantSpeciesSelect,
      },
      vault: true,
    },
  });
}

export async function deletePlant(userId: string, plantId: string) {
  const plant = await getPlantDetail(userId, plantId);
  await ensureVaultEditor(userId, plant.vaultId);

  await prisma.plant.delete({
    where: {
      id: plant.id,
    },
  });

  return {
    deleted: true,
    vaultId: plant.vaultId,
  };
}

export async function markPlantWatered(userId: string, plantId: string) {
  const plant = await getPlantDetail(userId, plantId);
  const wateredAt = new Date();

  return prisma.$transaction((tx) =>
    waterPlantWithRecord(tx, plant, userId, wateredAt),
  );
}

export async function markDashboardSectionWatered(
  userId: string,
  vaultId: string,
  section: DashboardSection,
  options?: {
    now?: Date;
  },
) {
  const dashboard = await getDashboard(userId, vaultId, options);
  const plantsToWater = dashboard[section];
  const wateredAt = options?.now ?? new Date();

  if (plantsToWater.length === 0) {
    return {
      section,
      updatedCount: 0,
      plants: [],
    };
  }

  const plants = await prisma.$transaction(async (tx) => {
    const updatedPlants = [];

    for (const plant of plantsToWater) {
      updatedPlants.push(
        await waterPlantWithRecord(tx, plant, userId, wateredAt),
      );
    }

    return updatedPlants;
  });

  return {
    section,
    updatedCount: plants.length,
    plants,
  };
}
