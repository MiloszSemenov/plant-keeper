"use client";

import {
  AnimatePresence,
  LayoutGroup,
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, type ReactElement, useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/ui/icon";
import { PlantCard } from "@/components/plant-card";
import { Section } from "@/components/ui/section";
import {
  type DashboardSectionKey,
  type DashboardPlant,
  type WateringDashboard,
  dashboardQueryKey,
  getVisibleSectionPlants,
  mergeDashboardPlant,
  rollbackFailedDashboardPlants,
  waterDashboardPlants,
} from "@/lib/watering-dashboard";

type DashboardWateringBoardProps = {
  initialDashboard: WateringDashboard;
  vaultId: string;
  devMode: {
    enabled: boolean;
    dayOffset?: number;
    now: Date;
  };
};

type WaterPlantResponse = {
  plant: DashboardPlant;
};

type BatchWaterResponse = {
  succeeded: Array<{
    plantId: string;
    plant: DashboardPlant;
  }>;
  failed: Array<{
    plantId: string;
    error: string;
  }>;
};

type OptimisticContext = {
  previous?: WateringDashboard;
  plantIds: string[];
};

const WATERING_ERROR = "There was a problem watering your plant";

async function fetchDashboard({
  vaultId,
  devMode,
  dayOffset,
}: {
  vaultId: string;
  devMode: boolean;
  dayOffset?: number;
}) {
  const params = new URLSearchParams({ vaultId });

  if (devMode) {
    params.set("devMode", "true");
  }

  if (dayOffset !== undefined) {
    params.set("dayOffset", String(dayOffset));
  }

  const response = await fetch(`/api/plants/dashboard?${params.toString()}`);

  if (!response.ok) {
    throw new Error("Unable to load dashboard");
  }

  return (await response.json()) as WateringDashboard;
}

async function postWaterPlant({
  plantId,
  wateredAt,
}: {
  plantId: string;
  wateredAt: string;
}) {
  const response = await fetch(`/api/plants/${plantId}/water`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wateredAt }),
  });

  if (!response.ok) {
    throw new Error(WATERING_ERROR);
  }

  return (await response.json()) as WaterPlantResponse;
}

async function postWaterPlants({
  plantIds,
  wateredAt,
}: {
  plantIds: string[];
  wateredAt: string;
}) {
  const response = await fetch("/api/plants/water", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ plantIds, wateredAt }),
  });

  if (!response.ok) {
    throw new Error(WATERING_ERROR);
  }

  return (await response.json()) as BatchWaterResponse;
}

const sectionMeta: Record<
  DashboardSectionKey,
  {
    eyebrow: string;
    title: string;
    emptyTitle: string;
    emptyDescription: string;
    badge: (count: number) => ReactElement;
  }
> = {
  overdue: {
    eyebrow: "Needs attention",
    title: "Overdue",
    emptyTitle: "Nothing is overdue",
    emptyDescription: "Your space is caught up. That's a good place to be.",
    badge: (count) =>
      count > 0 ? (
        <Badge tone="danger" uppercase>
          {count} overdue now
        </Badge>
      ) : (
        <Badge tone="success" uppercase>
          All clear
        </Badge>
      ),
  },
  today: {
    eyebrow: "Right now",
    title: "Today",
    emptyTitle: "Today looks clear",
    emptyDescription: "No plants are due today in this space.",
    badge: (count) => (
      <Badge tone={count > 0 ? "warning" : "neutral"} uppercase>
        {count > 0 ? `${count} due today` : "Nothing due"}
      </Badge>
    ),
  },
  upcoming: {
    eyebrow: "Coming up",
    title: "Upcoming",
    emptyTitle: "No upcoming watering tasks",
    emptyDescription: "Add a plant and Plant Keeper will schedule the next watering date.",
    badge: (count) => (
      <Badge tone={count > 0 ? "info" : "neutral"} uppercase>
        {count > 0 ? `${count} scheduled` : "Nothing scheduled"}
      </Badge>
    ),
  },
};

const MotionPlantCard = memo(function MotionPlantCard({
  isPending,
  onWater,
  plant,
  reducedMotion,
}: {
  isPending: boolean;
  onWater: (plantId: string) => void;
  plant: DashboardPlant;
  reducedMotion: boolean;
}) {
  return (
    <m.div
      className="watering-card-motion"
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985, y: 8 }}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      layoutId={`plant-card-${plant.id}`}
      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      layout
      transition={{
        duration: reducedMotion ? 0.01 : 0.28,
        ease: [0.22, 1, 0.36, 1],
        layout: {
          duration: reducedMotion ? 0.01 : 0.34,
          ease: [0.22, 1, 0.36, 1],
        },
      }}
    >
      <PlantCard isWatering={isPending} onWater={onWater} plant={plant} />
    </m.div>
  );
});

const WateringSection = memo(function WateringSection({
  availableCount,
  isBatching,
  onWater,
  onWaterAll,
  pendingPlantIds,
  plants,
  reducedMotion,
  section,
}: {
  availableCount: number;
  isBatching: boolean;
  onWater: (plantId: string) => void;
  onWaterAll: (section: DashboardSectionKey) => void;
  pendingPlantIds: Set<string>;
  plants: DashboardPlant[];
  reducedMotion: boolean;
  section: DashboardSectionKey;
}) {
  const meta = sectionMeta[section];

  return (
    <Section
      action={
        plants.length > 0 ? (
          <button
            className={buttonClassName({ variant: "secondary" })}
            disabled={availableCount === 0}
            onClick={() => onWaterAll(section)}
            type="button"
          >
            <Icon className="ui-button__icon" name="water" />
            <span className="ui-button__label">
              {isBatching ? "Watering..." : `Water all (${availableCount})`}
            </span>
          </button>
        ) : null
      }
      badge={meta.badge(plants.length)}
      bodyClassName="watering-section-grid"
      eyebrow={meta.eyebrow}
      subdued={section === "upcoming"}
      title={meta.title}
    >
      <AnimatePresence mode="popLayout">
        {plants.length > 0 ? (
          plants.map((plant) => (
            <MotionPlantCard
              isPending={pendingPlantIds.has(plant.id)}
              key={plant.id}
              onWater={onWater}
              plant={plant}
              reducedMotion={reducedMotion}
            />
          ))
        ) : (
          <m.div
            key={`${section}-empty`}
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.16 }}
          >
            <EmptyState
              description={meta.emptyDescription}
              title={meta.emptyTitle}
            />
          </m.div>
        )}
      </AnimatePresence>
    </Section>
  );
});

export function DashboardWateringBoard({
  initialDashboard,
  vaultId,
  devMode,
}: DashboardWateringBoardProps) {
  const queryClient = useQueryClient();
  const reducedMotion = useReducedMotion() ?? false;
  const pendingIdsRef = useRef(new Set<string>());
  const [pendingPlantIds, setPendingPlantIds] = useState<Set<string>>(new Set());
  const [batchingSections, setBatchingSections] = useState<Set<DashboardSectionKey>>(
    new Set(),
  );

  const queryKey = useMemo(
    () =>
      dashboardQueryKey({
        vaultId,
        devMode: devMode.enabled,
        dayOffset: devMode.dayOffset,
      }),
    [devMode.dayOffset, devMode.enabled, vaultId],
  );

  const { data = initialDashboard } = useQuery({
    queryKey,
    queryFn: () =>
      fetchDashboard({
        vaultId,
        devMode: devMode.enabled,
        dayOffset: devMode.dayOffset,
      }),
    initialData: initialDashboard,
  });

  const setPending = useCallback((plantIds: string[], pending: boolean) => {
    const next = new Set(pendingIdsRef.current);

    for (const plantId of plantIds) {
      if (pending) {
        next.add(plantId);
      } else {
        next.delete(plantId);
      }
    }

    pendingIdsRef.current = next;
    setPendingPlantIds(next);
  }, []);

  const setSectionBatching = useCallback(
    (section: DashboardSectionKey, pending: boolean) => {
      setBatchingSections((current) => {
        const next = new Set(current);

        if (pending) {
          next.add(section);
        } else {
          next.delete(section);
        }

        return next;
      });
    },
    [],
  );

  const waterPlantMutation = useMutation<
    WaterPlantResponse,
    Error,
    { plantId: string; wateredAt: string },
    OptimisticContext
  >({
    mutationFn: postWaterPlant,
    onMutate: async ({ plantId, wateredAt }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WateringDashboard>(queryKey);

      queryClient.setQueryData<WateringDashboard>(queryKey, (current) =>
        waterDashboardPlants(current, [plantId], new Date(wateredAt)),
      );

      return { previous, plantIds: [plantId] };
    },
    onError: (_error, _variables, context) => {
      queryClient.setQueryData<WateringDashboard>(queryKey, context?.previous);
      toast.error(WATERING_ERROR);
    },
    onSuccess: (payload) => {
      queryClient.setQueryData<WateringDashboard>(queryKey, (current) =>
        mergeDashboardPlant(current, payload.plant),
      );
    },
    onSettled: (_data, _error, _variables, context) => {
      setPending(context?.plantIds ?? [], false);
    },
  });

  const waterPlantsMutation = useMutation<
    BatchWaterResponse,
    Error,
    { plantIds: string[]; wateredAt: string; section: DashboardSectionKey },
    OptimisticContext
  >({
    mutationFn: ({ plantIds, wateredAt }) => postWaterPlants({ plantIds, wateredAt }),
    onMutate: async ({ plantIds, wateredAt }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<WateringDashboard>(queryKey);

      queryClient.setQueryData<WateringDashboard>(queryKey, (current) =>
        waterDashboardPlants(current, plantIds, new Date(wateredAt)),
      );

      return { previous, plantIds };
    },
    onError: (_error, variables, context) => {
      queryClient.setQueryData<WateringDashboard>(queryKey, (current) =>
        rollbackFailedDashboardPlants({
          current,
          snapshot: context?.previous,
          failedPlantIds: variables.plantIds,
        }),
      );
      toast.error("There was a problem watering these plants");
    },
    onSuccess: (payload, _variables, context) => {
      for (const item of payload.succeeded) {
        queryClient.setQueryData<WateringDashboard>(queryKey, (current) =>
          mergeDashboardPlant(current, item.plant),
        );
      }

      if (payload.failed.length > 0) {
        queryClient.setQueryData<WateringDashboard>(queryKey, (current) =>
          rollbackFailedDashboardPlants({
            current,
            snapshot: context?.previous,
            failedPlantIds: payload.failed.map((item) => item.plantId),
          }),
        );
        toast.error(
          payload.failed.length === 1
            ? WATERING_ERROR
            : `${payload.failed.length} plants could not be watered`,
        );
      }
    },
    onSettled: (_data, _error, variables, context) => {
      setPending(context?.plantIds ?? variables.plantIds, false);
      setSectionBatching(variables.section, false);
    },
  });

  const sections = useMemo(
    () => ({
      overdue: getVisibleSectionPlants(data, "overdue"),
      today: getVisibleSectionPlants(data, "today"),
      upcoming: getVisibleSectionPlants(data, "upcoming"),
    }),
    [data],
  );

  const waterPlant = useCallback(
    (plantId: string) => {
      if (pendingIdsRef.current.has(plantId)) {
        return;
      }

      setPending([plantId], true);
      waterPlantMutation.mutate({
        plantId,
        wateredAt: new Date().toISOString(),
      });
    },
    [setPending, waterPlantMutation],
  );

  const waterAll = useCallback(
    (section: DashboardSectionKey) => {
      const plantIds = sections[section]
        .map((plant) => plant.id)
        .filter((plantId) => !pendingIdsRef.current.has(plantId));

      if (plantIds.length === 0) {
        return;
      }

      setPending(plantIds, true);
      setSectionBatching(section, true);
      waterPlantsMutation.mutate({
        plantIds,
        section,
        wateredAt: new Date().toISOString(),
      });
    },
    [sections, setPending, setSectionBatching, waterPlantsMutation],
  );

  return (
    <LazyMotion features={domAnimation}>
      <LayoutGroup id={`dashboard-watering-${vaultId}`}>
        {(["overdue", "today", "upcoming"] as const).map((section) => {
          const availableCount = sections[section].filter(
            (plant) => !pendingPlantIds.has(plant.id),
          ).length;

          return (
            <WateringSection
              availableCount={availableCount}
              isBatching={batchingSections.has(section)}
              key={section}
              onWater={waterPlant}
              onWaterAll={waterAll}
              pendingPlantIds={pendingPlantIds}
              plants={sections[section]}
              reducedMotion={reducedMotion}
              section={section}
            />
          );
        })}

      </LayoutGroup>
    </LazyMotion>
  );
}
