import Link from "next/link";
import { formatDaysAgo } from "@/lib/time";
import { StatusPill } from "@/components/status-pill";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn, getPlantStatusLabel } from "@/lib/utils";
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

  return (
    <Card
      className={cn(
        "plant-card",
        status.tone === "danger" && "plant-card--danger",
        status.tone === "success" && "plant-card--muted"
      )}
      padding="none"
      tone={status.tone === "danger" ? "danger" : "default"}
    >
      <div className="plant-card-media">
        {plant.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={plant.nickname} src={plant.imageUrl} />
        ) : (
          <div className="plant-card-placeholder">
            <Icon className="plant-card-placeholder__icon" name="plant" />
            <span>{plant.nickname.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <Link
          aria-label={`View details for ${plant.nickname}`}
          className="plant-card-edit"
          href={`/plant/${plant.id}`}
        >
          <Icon className="plant-card-edit__icon" name="edit" />
        </Link>
      </div>
      <div className="plant-card-body">
        <div className="stack-xs">
          <StatusPill nextWateringAt={plant.nextWateringAt} now={plant.now} />
          <div>
            <h3>{plant.nickname}</h3>
            <p>{plant.species.scientificName}</p>
          </div>
          <p className={cn("plant-card-caption", status.tone === "danger" && "plant-card-caption--warning")}>
            Last watered{" "}
            {plant.lastWateredAt
              ? formatDaysAgo(plant.lastWateredAt, plant.now)
              : "Not yet recorded"}
          </p>
        </div>
        <div className="plant-card-actions">
          <Link className="plant-card-link" href={`/plant/${plant.id}`}>
            View details
          </Link>
          <MarkWateredButton
            icon="water"
            iconOnly
            label={`Mark ${plant.nickname} as watered`}
            plantId={plant.id}
            size="icon"
            variant="secondary"
          />
        </div>
      </div>
    </Card>
  );
}
