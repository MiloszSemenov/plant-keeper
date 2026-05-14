import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { ApiError } from "@/lib/http";
import { formatDate } from "@/lib/time";
import { getPlantDetail } from "@/services/plants";
import { PlantDetailEditor } from "@/components/plant-detail-editor";
import { PlantTopbar } from "@/components/plant-topbar";
import { Icon } from "@/components/ui/icon";
import { buttonClassName } from "@/components/ui/button";

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
      plant.notificationSettings[0]?.emailEnabled ??
      plant.vault.notificationSettings[0]?.emailEnabled ??
      false;

    return (
      <div className="main-area">
        <PlantTopbar
          canDelete={plant.canEdit}
          plantId={plant.id}
          vaultId={plant.vault.id}
        />
        <main className="detail-shell">
          <PlantDetailEditor
          canEdit={plant.canEdit}
          careNotes={plant.species.careNotes}
          createdAt={plant.createdAt}
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
          vaultId={plant.vault.id}
          vaultName={plant.vault.name}
          wateringIntervalDays={wateringIntervalDays}
          scheduleContent={
            <div className="detail-schedule-card">
              <div className="detail-schedule-card-header">
                <h2 className="detail-section-title">Schedule</h2>
              </div>
            <dl className="detail-schedule-list">
              <div className="detail-schedule-item">
                <Icon className="detail-schedule-icon detail-schedule-icon--muted" name="clockCounterClockwise" />
                <dt>Last watered</dt>
                <dd>
                  {plant.lastWateredAt
                    ? formatDate(plant.lastWateredAt)
                    : "Not yet recorded"}
                </dd>
              </div>
              <div className="detail-schedule-item detail-schedule-item--featured">
                <Icon className="detail-schedule-icon" name="calendarPlus" />
                <dt>Next watering</dt>
                <dd style={{ color: new Date(plant.nextWateringAt) < new Date() ? "var(--pk-color-tone-danger)" : undefined }}>
                  {formatDate(plant.nextWateringAt)}
                </dd>
              </div>
              <div className="detail-schedule-item">
                <Icon className="detail-schedule-icon detail-schedule-icon--muted" name="add" />
                <dt>Added on</dt>
                <dd>{formatDate(plant.createdAt)}</dd>
              </div>
            </dl>
            </div>
          }
          logContent={
            <div className="detail-log-section">
              <div className="detail-log-list">
                <div className="detail-outer-header detail-log-list-header">
                  <h2 className="detail-section-title">Watering Log</h2>
                  {plant.wateringEvents.length > 3 ? (
                    <button className={buttonClassName({ variant: "ghost", size: "text" })} type="button">
                      View all
                    </button>
                  ) : null}
                </div>
                {plant.wateringEvents.length > 0 ? (
                  plant.wateringEvents.slice(0, 3).map((event) => (
                    <div className="detail-log-item" key={event.id}>
                      <span className="detail-log-icon-wrap">
                        <Icon className="detail-log-icon" name="water" />
                      </span>
                      <div className="detail-log-text">
                        <strong>{event.user.name ?? event.user.email}</strong>
                        <span className="muted">Watered</span>
                      </div>
                      <time>{formatDate(event.wateredAt)}</time>
                    </div>
                  ))
                ) : (
                  <div className="detail-log-empty">
                    <Icon className="detail-log-empty__icon" name="listDashesFill" />
                    <p>No watering logs yet.</p>
                    <p className="muted">Logs will appear here after you mark it watered.</p>
                  </div>
                )}
              </div>
            </div>
          }
          membersContent={
            <div className="detail-members-wrap">
              <div className="detail-outer-header">
                <h2 className="detail-section-title">Shared Access</h2>
                <button aria-label="Add member" className="detail-panel-action" type="button">
                  <Icon name="userPlusFill" />
                  Add
                </button>
              </div>
              <article className="panel stack-md detail-members-panel">
                <div className="stack-sm">
                  {plant.vault.memberships.map((membership) => (
                    <div className="detail-member-row" key={membership.user.id}>
                      <div className="avatar-chip">
                        {(membership.user.name ?? membership.user.email).slice(0, 1).toUpperCase()}
                      </div>
                      <div className="detail-member-info">
                        <strong>{membership.user.name ?? membership.user.email}</strong>
                        <span className="muted">{getRoleLabel(membership.role)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          }
          />
        </main>
      </div>
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
      notFound();
    }

    throw error;
  }
}
