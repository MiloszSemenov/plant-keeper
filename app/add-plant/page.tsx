import { requireUser } from "@/lib/auth-helpers";
import { canManagePlants, listUserVaults } from "@/services/vaults";
import { AppShell } from "@/components/app-shell";
import { AddPlantForm } from "@/components/add-plant-form";
import { CreateVaultForm } from "@/components/create-vault-form";
import { EmptyState } from "@/components/empty-state";

type AddPlantPageProps = {
  searchParams: Promise<{
    vaultId?: string;
  }>;
};

export default async function AddPlantPage({ searchParams }: AddPlantPageProps) {
  const user = await requireUser();
  const memberships = await listUserVaults(user.id);

  if (memberships.length === 0) {
    return (
      <main className="marketing-shell">
        <section className="panel">
          <EmptyState
            eyebrow="Spaces"
            title="Create a space before adding plants"
            description="Spaces are the shared home for your collection, reminders, and members."
            action={<CreateVaultForm />}
          />
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const selectedMembership =
    memberships.find((membership) => membership.vault.id === params.vaultId) ?? memberships[0];
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
      canManagePlants={userCanManagePlants}
      currentPath="/add-plant"
      currentVaultId={selectedMembership.vault.id}
      description="Use a plant photo when you have one, or type the species yourself and let Plant Keeper fill in care data."
      title="Add a plant"
      userName={user.name}
      vaults={vaults}
    >
      {userCanManagePlants ? (
        <AddPlantForm
          initialVaultId={selectedMembership.vault.id}
          vaults={memberships.map((membership) => ({
            id: membership.vault.id,
            name: membership.vault.name
          }))}
        />
      ) : (
        <section className="panel">
          <EmptyState
            eyebrow="View only"
            title="This space does not allow plant edits"
            description="Members can water plants, but only owners and editors can add, edit, or delete them."
          />
        </section>
      )}
    </AppShell>
  );
}
