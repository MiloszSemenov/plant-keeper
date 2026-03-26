import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { ApiError } from "@/lib/http";
import { formatDate, formatDaysAgo } from "@/lib/time";
import { getPlantDetail } from "@/services/plants";
import { PlantDetailEditor } from "@/components/plant-detail-editor";

function getRoleLabel(role: string) {
  return role;
}

type PlantPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function PlantPage({ params }: PlantPageProps) {
  const user = await requireUser();
  const { id } = await params;

  try {
    const plant = await getPlantDetail(user.id, id);
    const wateringIntervalDays =
      plant.customWateringIntervalDays ?? plant.species.wateringIntervalDays;
    const effectivePlantNotifications =
      plant.notificationSettings[0]?.emailEnabled ?? plant.vault.notificationSettings[0]?.emailEnabled ?? false;

    return (
      <main className="detail-shell">
        <PlantDetailEditor
          canEdit={plant.canEdit}
          careNotes={plant.species.careNotes}
          fertilizerIntervalDays={plant.species.fertilizerIntervalDays}
          imageUrl={plant.imageUrl}
          lightRequirement={plant.species.lightRequirement}
          nextWateringAt={plant.nextWateringAt}
          nickname={plant.nickname}
          notificationsEnabled={effectivePlantNotifications}
          petToxic={plant.species.petToxic}
          plantId={plant.id}
          scientificName={plant.species.scientificName}
          soilType={plant.species.soilType}
          recommendedWateringIntervalDays={plant.wateringInsights.recommendedIntervalDays}
          observedWateringIntervalDays={plant.wateringInsights.observedIntervalDays}
          observedWateringEventCount={plant.wateringInsights.observedEventCount}
          vaultId={plant.vault.id}
          vaultName={plant.vault.name}
          wateringIntervalDays={wateringIntervalDays}
        >
          <article className="panel stack-sm">
            <p className="eyebrow">Schedule</p>
            <h2>Recent care</h2>
            <dl className="detail-list">
              <div>
                <dt>Last watered</dt>
                <dd>
                  {plant.lastWateredAt
                    ? `${formatDate(plant.lastWateredAt)} (${formatDaysAgo(plant.lastWateredAt)})`
                    : "Not yet recorded"}
                </dd>
              </div>
              <div>
                <dt>Next watering</dt>
                <dd>{formatDate(plant.nextWateringAt)}</dd>
              </div>
              <div>
                <dt>Added on</dt>
                <dd>{formatDate(plant.createdAt)}</dd>
              </div>
            </dl>
          </article>

          <article className="panel stack-sm">
            <p className="eyebrow">History</p>
            <h2>Watering log</h2>
            {plant.wateringEvents.length > 0 ? (
              <div className="stack-xs">
                {plant.wateringEvents.map((event) => (
                  <div className="history-item" key={event.id}>
                    <span>Watered by {event.user.name ?? event.user.email}</span>
                    <strong>{formatDate(event.wateredAt)}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">No watering events recorded yet.</p>
            )}
          </article>

          <article className="panel stack-sm">
            <p className="eyebrow">Shared space</p>
            <h2>Members with access</h2>
            <div className="stack-xs">
              {plant.vault.memberships.map((membership) => (
                <div className="member-row" key={membership.user.id}>
                  <strong>{membership.user.name ?? membership.user.email}</strong>
                  <span>{getRoleLabel(membership.role)}</span>
                </div>
              ))}
            </div>
          </article>
        </PlantDetailEditor>
      </main>
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      notFound();
    }

    throw error;
  }
}
