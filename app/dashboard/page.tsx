import Link from "next/link";
import { requireUserVault } from "@/lib/auth-helpers";
import { canManagePlants, getVaultActivity } from "@/services/vaults";
import { getDashboard } from "@/services/plants";
import { AppShell } from "@/components/app-shell";
import { buttonClassName } from "@/components/ui/button";
import { DevModePanel } from "@/components/dev-mode-panel";
import { getDevModeState } from "@/lib/dev-mode";
import { formatTimeAgo } from "@/lib/time";
import { DashboardWateringBoard } from "@/components/dashboard-watering-board";

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

      <DashboardWateringBoard
        devMode={devMode}
        initialDashboard={dashboard}
        vaultId={selectedMembership.vault.id}
      />
    </AppShell>
  );
}
