import { requireUser } from "@/lib/auth-helpers";
import { canManagePlants, listUserVaults, getVaultSettings } from "@/services/vaults";
import { AppShell } from "@/components/app-shell";
import { InviteForm } from "@/components/invite-form";
import { CreateVaultForm } from "@/components/create-vault-form";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/time";
import { NotificationSettingForm } from "@/components/notification-setting-form";
import { MemberActions } from "@/components/member-actions";

type VaultSettingsPageProps = {
  searchParams: Promise<{
    vaultId?: string;
  }>;
};

export default async function VaultSettingsPage({ searchParams }: VaultSettingsPageProps) {
  const user = await requireUser();
  const memberships = await listUserVaults(user.id);

  if (memberships.length === 0) {
    return (
      <main className="marketing-shell">
        <section className="panel">
          <EmptyState
            eyebrow="Spaces"
            title="Create a space first"
            description="Once you have a space, you can invite members and manage shared plant access."
            action={<CreateVaultForm />}
          />
        </section>
      </main>
    );
  }

  const params = await searchParams;
  const selectedMembership =
    memberships.find((membership) => membership.vault.id === params.vaultId) ?? memberships[0];
  const selectedVault = await getVaultSettings(user.id, selectedMembership.vault.id);
  const userCanManagePlants = canManagePlants(selectedMembership.role);
  const roleLabel =
    selectedMembership.role.charAt(0).toUpperCase() + selectedMembership.role.slice(1);
  const roleDescription =
    selectedMembership.role === "owner"
      ? "Owners manage plants and members."
      : selectedMembership.role === "editor"
        ? "Editors can manage plants."
        : "Members can view and water plants.";
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
      currentPath="/spaces/settings"
      currentVaultId={selectedVault.id}
      description="Invite members, review pending links, and keep each shared collection organized."
      title="Space settings"
      userName={user.name}
      vaults={vaults}
    >
      <section className="settings-grid">
        <article className="panel stack-sm">
          <p className="eyebrow">Current space</p>
          <h2>{selectedVault.name}</h2>
          <p className="muted">
            {selectedVault._count.plants} plants | {selectedVault.memberships.length} members
          </p>
          <div className="stack-xs">
            <strong>Your role: {roleLabel}</strong>
            <p className="muted">{roleDescription}</p>
          </div>
          <div className="stack-xs">
            {selectedMembership.role === "owner" ? (
              <InviteForm vaultId={selectedVault.id} />
            ) : (
              <p className="muted">Only owners can create invites for this space.</p>
            )}
          </div>
        </article>

        <article className="panel stack-sm">
          <p className="eyebrow">Members</p>
          <h2>Who can edit this space</h2>
          <div className="stack-xs">
            {selectedVault.memberships.map((membership) => (
              <div className="member-row" key={membership.user.id}>
                <div>
                  <strong>{membership.user.name ?? membership.user.email}</strong>
                  <p>{membership.user.email}</p>
                </div>
                <div className="stack-xs member-side">
                  <span className="member-role">{membership.role}</span>
                  {selectedMembership.role === "owner" &&
                  membership.role !== "owner" &&
                  membership.user.id !== user.id ? (
                    <MemberActions
                      initialRole={membership.role}
                      memberId={membership.user.id}
                      vaultId={selectedVault.id}
                    />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel stack-sm">
          <p className="eyebrow">Notifications</p>
          <h2>Your reminders for this space</h2>
          <NotificationSettingForm
            endpoint={`/api/vault/${selectedVault.id}/notifications`}
            initialEmailEnabled={selectedVault.notificationSettings[0]?.emailEnabled ?? false}
            label="Send watering reminders for plants in this space"
            variant="switch"
          />
        </article>

        <article className="panel stack-sm">
          <p className="eyebrow">Pending invites</p>
          <h2>Active links</h2>
          {selectedVault.invites.length > 0 ? (
            <div className="stack-xs">
              {selectedVault.invites.map((invite) => (
                <div className="history-item" key={invite.id}>
                  <div>
                    <strong>{invite.email || invite.code || "Open invite link"}</strong>
                    <p>
                      Created by {invite.createdBy.name ?? invite.createdBy.email} | expires{" "}
                      {formatDate(invite.expiresAt)}
                    </p>
                    {invite.code ? <p className="muted">Join code: {invite.code}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No pending invites yet.</p>
          )}
        </article>

        <article className="panel stack-sm">
          <p className="eyebrow">Create another space</p>
          <h2>New shared collection</h2>
          <CreateVaultForm />
        </article>
      </section>
    </AppShell>
  );
}
