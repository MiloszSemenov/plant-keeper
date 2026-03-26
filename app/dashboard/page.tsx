import Link from "next/link";
import { requireUserVault } from "@/lib/auth-helpers";
import { canManagePlants, getVaultActivity } from "@/services/vaults";
import { getDashboard } from "@/services/plants";
import { AppShell } from "@/components/app-shell";
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
          <Link className="button button-primary" href={`/add-plant?vaultId=${selectedMembership.vault.id}`}>
            Add plant
          </Link>
        ) : undefined
      }
      canManagePlants={userCanManagePlants}
      currentPath="/dashboard"
      currentVaultId={selectedMembership.vault.id}
      description="See what needs water first, what is coming up next, and which space is currently in focus."
      title={selectedMembership.vault.name}
      userName={user.name}
      vaults={vaults}
    >
      {devMode.enabled ? (
        <DevModePanel dayOffset={devMode.dayOffset} vaultId={selectedMembership.vault.id} />
      ) : null}

      <section className="dashboard-summary">
        <article className="panel stat-panel">
          <span>Overdue</span>
          <strong>{dashboard.overdue.length}</strong>
        </article>
        <article className="panel stat-panel">
          <span>Today</span>
          <strong>{dashboard.today.length}</strong>
        </article>
        <article className="panel stat-panel">
          <span>Upcoming</span>
          <strong>{dashboard.upcoming.length}</strong>
        </article>
      </section>

      <section className="dashboard-columns">
        <div className="stack-md">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Needs attention</p>
              <h2>Overdue</h2>
            </div>
            {dashboard.overdue.length > 0 ? (
              <MarkWateredButton
                dashboardAction={{
                  vaultId: selectedMembership.vault.id,
                  section: "overdue",
                  devMode: devMode.enabled,
                  dayOffset: devMode.dayOffset
                }}
                label="Mark all watered"
              />
            ) : null}
          </div>
          {dashboard.overdue.length > 0 ? (
            dashboard.overdue.map((plant) => (
              <PlantCard key={plant.id} plant={{ ...plant, now: devMode.now }} />
            ))
          ) : (
            <EmptyState
              title="Nothing is overdue"
              description="Your space is caught up. That&apos;s a good place to be."
            />
          )}
        </div>

        <div className="stack-md">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Right now</p>
              <h2>Today</h2>
            </div>
            {dashboard.today.length > 0 ? (
              <MarkWateredButton
                dashboardAction={{
                  vaultId: selectedMembership.vault.id,
                  section: "today",
                  devMode: devMode.enabled,
                  dayOffset: devMode.dayOffset
                }}
                label="Mark all watered"
              />
            ) : null}
          </div>
          {dashboard.today.length > 0 ? (
            dashboard.today.map((plant) => (
              <PlantCard key={plant.id} plant={{ ...plant, now: devMode.now }} />
            ))
          ) : (
            <EmptyState
              title="Today looks clear"
              description="No plants are due today in this space."
            />
          )}
        </div>

        <div className="stack-md">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Coming up</p>
              <h2>Upcoming</h2>
            </div>
            {dashboard.upcoming.length > 0 ? (
              <MarkWateredButton
                dashboardAction={{
                  vaultId: selectedMembership.vault.id,
                  section: "upcoming",
                  devMode: devMode.enabled,
                  dayOffset: devMode.dayOffset
                }}
                label="Mark all watered"
              />
            ) : null}
          </div>
          {dashboard.upcoming.length > 0 ? (
            dashboard.upcoming.map((plant) => (
              <PlantCard key={plant.id} plant={{ ...plant, now: devMode.now }} />
            ))
          ) : (
            <EmptyState
              title="No upcoming watering tasks"
              description="Add a plant and Plant Keeper will schedule the next watering date."
            />
          )}
        </div>
      </section>

      <section className="panel stack-sm">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent activity</p>
            <h2>What happened in this space</h2>
          </div>
        </div>
        {activity.length > 0 ? (
          <div className="stack-xs">
            {activity.map((entry) => (
              <div className="history-item" key={entry.id}>
                <span>{entry.description}</span>
                <strong>{formatTimeAgo(entry.createdAt)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No recent activity yet"
            description="Add a plant, water one, or invite someone to start the activity feed."
          />
        )}
      </section>
    </AppShell>
  );
}
