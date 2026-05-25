import { addDays } from "@/lib/time";

export type DashboardSectionKey = "overdue" | "today" | "upcoming";

export type DashboardPlant = {
  id: string;
  vaultId: string;
  nickname: string;
  imageUrl: string | null;
  lastWateredAt: Date | string | null;
  nextWateringAt: Date | string;
  customWateringIntervalDays: number | null;
  species: {
    scientificName: string;
    wateringIntervalDays: number;
  };
};

export type WateringDashboard = {
  overdue: DashboardPlant[];
  today: DashboardPlant[];
  upcoming: DashboardPlant[];
  recentlyWatered: DashboardPlant[];
};

export const DASHBOARD_SECTIONS: DashboardSectionKey[] = [
  "overdue",
  "today",
  "upcoming",
];

export function dashboardQueryKey({
  vaultId,
  devMode,
  dayOffset,
}: {
  vaultId: string;
  devMode: boolean;
  dayOffset?: number;
}) {
  return ["dashboard", vaultId, devMode, dayOffset ?? null] as const;
}

export function getEffectiveWateringIntervalDays(plant: DashboardPlant) {
  return plant.customWateringIntervalDays ?? plant.species.wateringIntervalDays;
}

export function optimisticWateredPlant(
  plant: DashboardPlant,
  wateredAt: Date,
): DashboardPlant {
  return {
    ...plant,
    lastWateredAt: wateredAt,
    nextWateringAt: addDays(wateredAt, getEffectiveWateringIntervalDays(plant)),
  };
}

export function findDashboardPlant(
  dashboard: WateringDashboard | undefined,
  plantId: string,
) {
  if (!dashboard) {
    return undefined;
  }

  for (const section of [...DASHBOARD_SECTIONS, "recentlyWatered"] as const) {
    const plant = dashboard[section].find((item) => item.id === plantId);

    if (plant) {
      return plant;
    }
  }

  return undefined;
}

function removePlantIds<T extends { id: string }>(plants: T[], plantIds: Set<string>) {
  return plants.filter((plant) => !plantIds.has(plant.id));
}

function dedupeById(plants: DashboardPlant[]) {
  const seen = new Set<string>();

  return plants.filter((plant) => {
    if (seen.has(plant.id)) {
      return false;
    }

    seen.add(plant.id);
    return true;
  });
}

function sortByNextWatering(plants: DashboardPlant[]) {
  return [...plants].sort(
    (left, right) =>
      new Date(left.nextWateringAt).getTime() -
      new Date(right.nextWateringAt).getTime(),
  );
}

export function waterDashboardPlants(
  dashboard: WateringDashboard | undefined,
  plantIds: string[],
  wateredAt: Date,
): WateringDashboard | undefined {
  if (!dashboard || plantIds.length === 0) {
    return dashboard;
  }

  const idSet = new Set(plantIds);
  const wateredPlants = plantIds
    .map((plantId) => findDashboardPlant(dashboard, plantId))
    .filter((plant): plant is DashboardPlant => Boolean(plant))
    .map((plant) => optimisticWateredPlant(plant, wateredAt));

  return {
    overdue: removePlantIds(dashboard.overdue, idSet),
    today: removePlantIds(dashboard.today, idSet),
    upcoming: sortByNextWatering(
      dedupeById([
        ...wateredPlants,
        ...removePlantIds(dashboard.upcoming, idSet),
      ]),
    ),
    recentlyWatered: dashboard.recentlyWatered,
  };
}

function restoreFailedSection(
  current: DashboardPlant[],
  snapshot: DashboardPlant[],
  failedIds: Set<string>,
) {
  const currentById = new Map(current.map((plant) => [plant.id, plant]));
  const restored: DashboardPlant[] = [];

  for (const snapshotPlant of snapshot) {
    if (failedIds.has(snapshotPlant.id)) {
      restored.push(snapshotPlant);
      continue;
    }

    const currentPlant = currentById.get(snapshotPlant.id);
    if (currentPlant) {
      restored.push(currentPlant);
      currentById.delete(snapshotPlant.id);
    }
  }

  return [...restored, ...currentById.values()];
}

export function rollbackFailedDashboardPlants({
  current,
  snapshot,
  failedPlantIds,
}: {
  current: WateringDashboard | undefined;
  snapshot: WateringDashboard | undefined;
  failedPlantIds: string[];
}): WateringDashboard | undefined {
  if (!current || !snapshot || failedPlantIds.length === 0) {
    return current;
  }

  const failedIds = new Set(failedPlantIds);
  const withoutFailed = {
    overdue: removePlantIds(current.overdue, failedIds),
    today: removePlantIds(current.today, failedIds),
    upcoming: removePlantIds(current.upcoming, failedIds),
    recentlyWatered: removePlantIds(current.recentlyWatered, failedIds),
  };

  return {
    overdue: restoreFailedSection(withoutFailed.overdue, snapshot.overdue, failedIds),
    today: restoreFailedSection(withoutFailed.today, snapshot.today, failedIds),
    upcoming: restoreFailedSection(withoutFailed.upcoming, snapshot.upcoming, failedIds),
    recentlyWatered: restoreFailedSection(
      withoutFailed.recentlyWatered,
      snapshot.recentlyWatered,
      failedIds,
    ),
  };
}

export function mergeDashboardPlant(
  dashboard: WateringDashboard | undefined,
  plant: DashboardPlant,
): WateringDashboard | undefined {
  if (!dashboard) {
    return dashboard;
  }

  const replace = (plants: DashboardPlant[]) =>
    plants.map((item) => (item.id === plant.id ? { ...item, ...plant } : item));

  return {
    overdue: replace(dashboard.overdue),
    today: replace(dashboard.today),
    upcoming: replace(dashboard.upcoming),
    recentlyWatered: replace(dashboard.recentlyWatered),
  };
}

export function getVisibleSectionPlants(
  dashboard: WateringDashboard,
  section: DashboardSectionKey,
) {
  return dashboard[section];
}
