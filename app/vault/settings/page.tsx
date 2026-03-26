import { requireUserVault } from "@/lib/auth-helpers";
import { canManagePlants, getVaultSettings } from "@/services/vaults";
import { type VaultInviteStatus, listVaultInvitesForSettings } from "@/services/invites";
import { AppShell } from "@/components/app-shell";
import { InviteForm } from "@/components/invite-form";
import { CreateVaultForm } from "@/components/create-vault-form";
import { EmptyState } from "@/components/empty-state";
import { formatDate } from "@/lib/time";
import { NotificationSettingForm } from "@/components/notification-setting-form";
import { MemberActions } from "@/components/member-actions";
import { ManageInviteButton } from "@/components/manage-invite-button";
import { SpaceMembershipAction } from "@/components/space-membership-action";

function getRoleLabel(role: string) {
  return role;
}

function getInviteStatusPresentation(status: VaultInviteStatus) {
  if (status === "joined") {
    return {
      label: "joined",
      tone: "success"
    };
  }

  if (status === "declined") {
    return {
      label: "declined",
      tone: "danger"
    };
  }

  if (status === "expired") {
    return {
      label: "expired",
      tone: "neutral"
    };
  }

  return {
    label: "waiting",
    tone: "warning"
  };
}

type VaultSettingsPageProps = {
  searchParams: Promise<{
    vaultId?: string;
  }>;
};

export default async function VaultSettingsPage({ searchParams }: VaultSettingsPageProps) {
  const params = await searchParams;
  const { user, memberships, selectedMembership } = await requireUserVault(params.vaultId);
  const selectedVault = await getVaultSettings(user.id, selectedMembership.vault.id);
  const invites = await listVaultInvitesForSettings({
    userId: user.id,
    vaultId: selectedVault.id
  });
  const userCanManagePlants = canManagePlants(selectedMembership.role);
  const displayRole = getRoleLabel(selectedMembership.role);
  const roleLabel = displayRole.charAt(0).toUpperCase() + displayRole.slice(1);
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
      description="Invite members, review link status, and keep each shared collection organized."
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
          <div className="stack-xs">
            <SpaceMembershipAction
              action={selectedMembership.role === "owner" ? "delete" : "leave"}
              vaultId={selectedVault.id}
            />
          </div>
        </article>

        <article className="panel stack-sm">
          <p className="eyebrow">Members</p>
          <h2>Who is in this space</h2>
          <div className="stack-xs">
            {selectedVault.memberships.map((membership) => (
              <div className="member-row" key={membership.user.id}>
                <div>
                  <strong>{membership.user.email}</strong>
                  {membership.user.name && membership.user.name !== membership.user.email ? (
                    <p>{membership.user.name}</p>
                  ) : null}
                </div>
                <div className="stack-xs member-side">
                  {selectedMembership.role === "owner" &&
                  membership.role !== "owner" &&
                  membership.user.id !== user.id ? (
                    <MemberActions
                      initialRole={membership.role}
                      memberId={membership.user.id}
                      vaultId={selectedVault.id}
                    />
                  ) : (
                    <span className="member-role">{getRoleLabel(membership.role)}</span>
                  )}
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
          <p className="eyebrow">Invite links</p>
          <h2>Share and manage access</h2>
          {invites.length > 0 ? (
            <div className="stack-xs">
              {invites.map((invite) => {
                const inviteStatus = getInviteStatusPresentation(invite.status);

                return (
                  <div className="history-item" key={invite.id}>
                    <div>
                      <div className="inline-actions">
                        <strong>{invite.email || invite.code || "Open invite link"}</strong>
                        <span className={`status-pill status-${inviteStatus.tone}`}>
                          {inviteStatus.label}
                        </span>
                      </div>
                      <p>
                        Created by {invite.createdBy.name ?? invite.createdBy.email} | expires{" "}
                        {formatDate(invite.expiresAt)}
                      </p>
                      {invite.email ? <p className="muted">Reserved for {invite.email}</p> : null}
                      {invite.code ? <p className="muted">Join code: {invite.code}</p> : null}
                      {invite.status === "joined" && invite.acceptedBy ? (
                        <p className="muted">
                          Joined by {invite.acceptedBy.name ?? invite.acceptedBy.email}
                        </p>
                      ) : null}
                    </div>
                    <ManageInviteButton
                      inviteId={invite.id}
                      label={invite.status === "waiting" ? "Invalidate invite" : "Remove invite"}
                      vaultId={selectedVault.id}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted">No invite links yet.</p>
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
