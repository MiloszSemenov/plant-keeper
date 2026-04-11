import Link from "next/link";
import Image from "next/image";
import { formatDaysAgo } from "@/lib/time";
import { StatusPill } from "@/components/status-pill";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn, getPlantStatusLabel } from "@/lib/utils";
import { PlantCardEditButton } from "./plant-card-edit-button";

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
  const showScientificName = plant.nickname !== plant.species.scientificName;

  return (
    <Card
      className={cn(
        "plant-card transition hover:shadow-md",
        status.tone === "danger" && "plant-card--danger",
        status.tone === "success" && "plant-card--muted"
      )}
      padding="none"
      tone={status.tone === "danger" ? "danger" : "default"}
    >
      <Link href={`/plant/${plant.id}`} className="block plant-card-media relative">
        {plant.imageUrl ? (
          <Image
            src={plant.imageUrl}
            alt={plant.nickname}
            fill
            className="object-cover"
          />
        ) : (
          <div className="plant-card-placeholder">
            <Icon className="plant-card-placeholder__icon" name="plant" />
            <span>{plant.nickname.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <div className="plant-card-status">
          <StatusPill
            nextWateringAt={plant.nextWateringAt}
            now={plant.now}
          />
        </div>
      </Link>

      {/* <PlantCardEditButton
        plantId={plant.id}
        nickname={plant.nickname}
      /> */}

      <div className="plant-card-body">
        <div className="stack-sm">
          <div>
            <h3>{plant.nickname}</h3>

            {showScientificName && (
              <p className="text-muted text-sm">
                {plant.species.scientificName}
              </p>
            )}
          </div>
                    <p className={cn("plant-card-caption", status.tone === "danger" && "plant-card-caption--warning")}>
            Last watered{" "}
            {plant.lastWateredAt
              ? formatDaysAgo(plant.lastWateredAt, plant.now)
              : "Not yet recorded"}
          </p>
        </div>

        <div className="plant-card-actions">
          <MarkWateredButton
            icon="water"
            // label={`Water ${plant.nickname}`}
            plantId={plant.id}
            variant="secondary"
          />
        </div>
      </div>
    </Card>
  );
}