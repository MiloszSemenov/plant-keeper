import { formatDaysAgo } from "@/lib/time";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { PlantCardBase } from "@/components/plant-card-base";
import { getPlantStatusLabel } from "@/lib/utils";

type PlantCardPlant = {
  id: string;
  nickname: string;
  imageUrl: string | null;
  lastWateredAt: Date | null;
  nextWateringAt: Date;
  now?: Date;
  species: {
    scientificName: string;
  };
};

export function PlantCard({ plant }: { plant: PlantCardPlant }) {
  const status = getPlantStatusLabel(plant.nextWateringAt, plant.now);

  const baseStatus =
    status.tone === "danger"
      ? "overdue"
      : status.tone === "warning"
        ? "today"
        : "upcoming";

  const lastWateredText = plant.lastWateredAt
    ? formatDaysAgo(plant.lastWateredAt, plant.now)
    : "Not yet recorded";

  return (
    <PlantCardBase
      actions={
        <MarkWateredButton
          icon="water"
          plantId={plant.id}
          variant="secondary"
        />
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
