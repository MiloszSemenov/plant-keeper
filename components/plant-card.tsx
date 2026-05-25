import { formatDaysAgo } from "@/lib/time";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { PlantCardBase } from "@/components/plant-card-base";
import { Icon } from "@/components/ui/icon";
import { getPlantStatusLabel } from "@/lib/utils";
import { memo } from "react";

type PlantCardPlant = {
  id: string;
  nickname: string;
  imageUrl: string | null;
  lastWateredAt: Date | string | null;
  nextWateringAt: Date | string;
  now?: Date | string;
  species: {
    scientificName: string;
  };
};

function PlantCardComponent({
  plant,
  isWatering = false,
  onWater,
}: {
  plant: PlantCardPlant;
  isWatering?: boolean;
  onWater?: (plantId: string) => void;
}) {
  const now = typeof plant.now === "string" ? new Date(plant.now) : plant.now;
  const status = getPlantStatusLabel(plant.nextWateringAt, now);

  const baseStatus =
    status.tone === "danger"
      ? "overdue"
      : status.tone === "warning"
        ? "today"
        : "upcoming";

  const lastWateredText = plant.lastWateredAt
    ? formatDaysAgo(plant.lastWateredAt, now)
    : "Not yet recorded";

  return (
    <PlantCardBase
      actions={
        onWater ? (
          <button
            aria-busy={isWatering}
            className="ui-button ui-button--secondary ui-button--md"
            disabled={isWatering}
            onClick={() => onWater(plant.id)}
            type="button"
          >
            <Icon className="ui-button__icon" name="water" />
            <span className="ui-button__label">
              {isWatering ? "Watering..." : "Mark watered"}
            </span>
          </button>
        ) : (
          <MarkWateredButton
            icon="water"
            plantId={plant.id}
            variant="secondary"
          />
        )
      }
      imageUrl={plant.imageUrl}
      lastWateredText={lastWateredText}
      mediaHref={`/plant/${plant.id}`}
      name={plant.nickname}
      scientificName={plant.species.scientificName}
      status={baseStatus}
      statusLabel={status.text}
    />
  );
}

export const PlantCard = memo(PlantCardComponent);
