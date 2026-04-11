import Link from "next/link";
import { requireUserVault } from "@/lib/auth-helpers";
import { canManagePlants, getVaultActivity } from "@/services/vaults";
import { getDashboard } from "@/services/plants";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button";
import { Section } from "@/components/ui/section";
import { DevModePanel } from "@/components/dev-mode-panel";
import { MarkWateredButton } from "@/components/mark-watered-button";
import { getDevModeState } from "@/lib/dev-mode";
import { PlantCard } from "@/components/plant-card";
import { EmptyState } from "@/components/empty-state";
import { formatTimeAgo } from "@/lib/time";

type DashboardPageProps = {
  searchParams: Promise<{
    vaultId?: string;
    devMode?: string;
    dayOffset?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const { user, memberships, selectedMembership } = await requireUserVault(params.vaultId);
  const userCanManagePlants = canManagePlants(selectedMembership.role);
  const devMode = getDevModeState(params);
  const dashboard = await getDashboard(user.id, selectedMembership.vault.id, {
    now: devMode.now
  });
  const activity = await getVaultActivity(user.id, selectedMembership.vault.id);
  const vaults = memberships.map((membership) => ({
    id: membership.vault.id,
    name: membership.vault.name,
    role: membership.role,
    plantCount: membership.vault._count.plants,
    memberCount: membership.vault._count.memberships
  }));

  return (
    <AppShell
      actions={
        userCanManagePlants ? (
          <Link
            className={buttonClassName({
              size: "sm",
              variant: "primary"
            })}
            href={`/add-plant?vaultId=${selectedMembership.vault.id}`}
          >
            Add plant
          </Link>
        ) : undefined
      }
      canManagePlants={userCanManagePlants}
      currentPath="/dashboard"
      currentVaultId={selectedMembership.vault.id}
      description=""
      title={selectedMembership.vault.name}
      userImageUrl={user.image}
      userName={user.name}
      vaults={vaults}
      sidebarContent={
        <section className="activity-rail">
          <p className="sidebar-label">Recent logs</p>
          {activity.length > 0 ? (
            <div className="activity-timeline">
              {activity.slice(0, 3).map((entry, index) => {
                const tone = index % 3;
                return (
                  <div className="activity-item" key={entry.id}>
                    <div
                      className={`activity-dot ${
                        tone === 0
                          ? "activity-dot--secondary"
                          : tone === 1
                          ? "activity-dot--primary"
                          : "activity-dot--outline"
                      }`}
                    />

                    <p className="activity-text">{entry.description}</p>
                    <span className="activity-time">
                      {formatTimeAgo(entry.createdAt)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No recent activity yet.</p>
          )}
        </section>
      }
    >
      {devMode.enabled ? (
        <DevModePanel dayOffset={devMode.dayOffset} vaultId={selectedMembership.vault.id} />
      ) : null}

      <Section
        action={
          dashboard.overdue.length > 0 ? (
            <MarkWateredButton
              dashboardAction={{
                vaultId: selectedMembership.vault.id,
                section: "overdue",
                devMode: devMode.enabled,
                dayOffset: devMode.dayOffset
              }}
              icon="water"
              label={`Water all (${dashboard.overdue.length})`}
              variant="secondary"
            />
          ) : null
        }
        badge={
          dashboard.overdue.length > 0 ? (
            <Badge tone="danger" uppercase>
              {dashboard.overdue.length > 0
                ? `${dashboard.overdue.length} overdue now`
                : "All clear"}
            </Badge>
          ) : (
            <Badge tone="success" uppercase>
              All clear
            </Badge>
          )
        }
        eyebrow="Needs attention"
        title="Overdue"
      >
        {dashboard.overdue.length > 0 ? (
          dashboard.overdue.map((plant) => (
            <PlantCard key={plant.id} plant={{ ...plant, now: devMode.now }} />
          ))
        ) : (
          <EmptyState
            description="Your space is caught up. That&apos;s a good place to be."
            title="Nothing is overdue"
          />
        )}
      </Section>

      <Section
        action={
          dashboard.today.length > 0 ? (
            <MarkWateredButton
              dashboardAction={{
                vaultId: selectedMembership.vault.id,
                section: "today",
                devMode: devMode.enabled,
                dayOffset: devMode.dayOffset
              }}
              icon="water"
              label={`Water all (${dashboard.today.length})`}
              variant="secondary"
            />
          ) : null
        }
        badge={
          <Badge tone={dashboard.today.length > 0 ? "warning" : "neutral"} uppercase>
            {dashboard.today.length > 0 ? `${dashboard.today.length} due today` : "Nothing due"}
          </Badge>
        }
        eyebrow="Right now"
        title="Today"
      >
        {dashboard.today.length > 0 ? (
          dashboard.today.map((plant) => (
            <PlantCard key={plant.id} plant={{ ...plant, now: devMode.now }} />
          ))
        ) : (
          <EmptyState
            description="No plants are due today in this space."
            title="Today looks clear"
          />
        )}
      </Section>

      <Section
        action={
          dashboard.upcoming.length > 0 ? (
            <MarkWateredButton
              dashboardAction={{
                vaultId: selectedMembership.vault.id,
                section: "upcoming",
                devMode: devMode.enabled,
                dayOffset: devMode.dayOffset
              }}
              icon="water"
              label={`Water all (${dashboard.upcoming.length})`}
              variant="secondary"
            />
          ) : null
        }
        badge={
          <Badge tone={dashboard.upcoming.length > 0 ? "info" : "neutral"} uppercase>
            {dashboard.upcoming.length > 0
              ? `${dashboard.upcoming.length} scheduled`
              : "Nothing scheduled"}
          </Badge>
        }
        eyebrow="Coming up"
        subdued
        title="Upcoming"
      >
        {dashboard.upcoming.length > 0 ? (
          dashboard.upcoming.map((plant) => (
            <PlantCard key={plant.id} plant={{ ...plant, now: devMode.now }} />
          ))
        ) : (
          <EmptyState
            description="Add a plant and Plant Keeper will schedule the next watering date."
            title="No upcoming watering tasks"
          />
        )}
      </Section>
    </AppShell>
  );
}
