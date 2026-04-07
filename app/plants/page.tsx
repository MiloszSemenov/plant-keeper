import Link from "next/link";
import { requireUserVault } from "@/lib/auth-helpers";
import { canManagePlants } from "@/services/vaults";
import { getVaultPlants } from "@/services/plants";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/empty-state";
import { PlantCard } from "@/components/plant-card";
import { buttonClassName } from "@/components/ui/button";

type PlantsPageProps = {
  searchParams: Promise<{
    vaultId?: string;
  }>;
};

export default async function PlantsPage({ searchParams }: PlantsPageProps) {
  const params = await searchParams;
  const { user, memberships, selectedMembership } = await requireUserVault(params.vaultId);
  const plants = await getVaultPlants(user.id, selectedMembership.vault.id);
  const userCanManagePlants = canManagePlants(selectedMembership.role);
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
              variant: "primary"
            })}
            href={`/add-plant?vaultId=${selectedMembership.vault.id}`}
          >
            Add plant
          </Link>
        ) : undefined
      }
      canManagePlants={userCanManagePlants}
      currentPath="/plants"
      currentVaultId={selectedMembership.vault.id}
      description="Browse every plant in the current space without splitting the list into watering sections."
      title="All plants"
      userName={user.name}
      vaults={vaults}
    >
      {plants.length > 0 ? (
        <section className="plant-grid">
          {plants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </section>
      ) : (
        <section className="panel">
          <EmptyState
            eyebrow="Plants"
            title="No plants in this space yet"
            description="Add the first plant to start tracking watering, reminders, and care history."
          />
        </section>
      )}
    </AppShell>
  );
}
