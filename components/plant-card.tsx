import Link from "next/link";
import { formatDaysAgo } from "@/lib/time";
import { StatusPill } from "@/components/status-pill";
import { MarkWateredButton } from "@/components/mark-watered-button";

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
  return (
    <article className="plant-card">
      <div className="plant-card-media">
        {plant.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={plant.nickname} src={plant.imageUrl} />
        ) : (
          <div className="plant-card-placeholder">
            <span>{plant.nickname.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="plant-card-body">
        <div className="stack-xs">
          <StatusPill nextWateringAt={plant.nextWateringAt} now={plant.now} />
          <div>
            <h3>{plant.nickname}</h3>
            <p>{plant.species.scientificName}</p>
          </div>
          <p className="muted">
            Last watered:{" "}
            {plant.lastWateredAt
              ? formatDaysAgo(plant.lastWateredAt, plant.now)
              : "Not yet recorded"}
          </p>
        </div>
        <div className="plant-card-actions">
          <Link className="button button-ghost" href={`/plant/${plant.id}`}>
            View details
          </Link>
          <MarkWateredButton plantId={plant.id} />
        </div>
      </div>
    </article>
  );
}
