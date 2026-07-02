import { requireUserVault } from "@/lib/auth-helpers";
import { canManagePlants, getVaultSettings } from "@/services/vaults";
import { listVaultInvitesForSettings } from "@/services/invites";
import { AppShell } from "@/components/app-shell";
import { InviteMemberAction } from "@/components/invite-member-action";
import { NotificationSettingForm } from "@/components/notification-setting-form";
import { MemberActions } from "@/components/member-actions";
import { Avatar } from "@/components/ui/avatar";
import { SpaceNameEditor } from "@/components/space-name-editor";
import { SpaceAvatar } from "@/components/space-avatar";
import { InviteListItem } from "@/components/invite-list-item";
import { InvitesDialog } from "@/components/invites-dialog";
import { GenerateLinkAction } from "@/components/generate-link-action";
import { SpaceSettingsMenu } from "@/components/space-settings-menu";
import { GoogleCalendarConnectButton } from "@/components/google-calendar-connect-button";
import { GoogleCalendarDisconnectButton } from "@/components/google-calendar-disconnect-button";
import { buttonClassName } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import {
  getGoogleCalendarIntegration,
  isGoogleCalendarConnected
} from "@/services/google-calendar";

function getRoleLabel(role: string) {
  return role;
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
  const googleCalendarIntegration = await getGoogleCalendarIntegration(user.id);
  const googleCalendarConnected = isGoogleCalendarConnected(googleCalendarIntegration);
  const googleCalendarCallbackUrl = `/spaces/settings?vaultId=${selectedVault.id}`;
  const vaults = memberships.map((membership) => ({
    id: membership.vault.id,
    name: membership.vault.name,
    role: membership.role,
    plantCount: membership.vault._count.plants,
    memberCount: membership.vault._count.memberships
  }));
  const isOwner = selectedMembership.role === "owner";
  const plantCount = selectedVault._count.plants;
  const memberCount = selectedVault.memberships.length;
  const remindersEnabled = selectedVault.notificationSettings[0]?.emailEnabled ?? false;
  const addPlantHref = `/add-plant?vaultId=${selectedVault.id}`;
  // Space cover: a user-set photo takes priority, otherwise pick a random plant photo.
  const hasCustomCover = Boolean(selectedVault.coverImageUrl);
  const plantsWithImages = selectedVault.plants;
  const randomPlantImage =
    plantsWithImages.length > 0
      ? plantsWithImages[Math.floor(Math.random() * plantsWithImages.length)].imageUrl
      : null;
  const coverImageUrl = selectedVault.coverImageUrl ?? randomPlantImage;
  const inviteListData = invites
    .filter((invite) => invite.email)
    .map((invite) => ({
      id: invite.id,
      email: invite.email,
      status: invite.status,
      expiresAt: invite.expiresAt,
      createdBy: { name: invite.createdBy.name, email: invite.createdBy.email },
      acceptedBy: invite.acceptedBy
        ? { name: invite.acceptedBy.name, email: invite.acceptedBy.email }
        : null
    }));
  const visibleInvites = inviteListData.slice(0, 3);

  return (
    <AppShell
      canManagePlants={userCanManagePlants}
      currentPath="/spaces/settings"
      currentVaultId={selectedVault.id}
      title="Settings"
      userImageUrl={user.image}
      userName={user.name}
      vaults={vaults}
    >
      <div className="settings-page">
        <div className="settings-layout">
          {/* ── Main column ──────────────────────────────── */}
          <div className="settings-main">

            {/* Space header card */}
            <section className="settings-card settings-space-card">
              <SpaceAvatar
                canEdit={isOwner}
                hasCustomCover={hasCustomCover}
                imageUrl={coverImageUrl}
                name={selectedVault.name}
                vaultId={selectedVault.id}
              />
              <div className="settings-space-card__body">
                <div className="settings-space-card__title">
                  <SpaceNameEditor
                    canEdit={isOwner}
                    initialName={selectedVault.name}
                    vaultId={selectedVault.id}
                  />
                </div>
                <p className="settings-space-meta">
                  {plantCount} plants · {memberCount} members
                </p>
                <div className="settings-space-status">
                  <span className="settings-space-status__item">
                    <Icon name={remindersEnabled ? "notificationFill" : "notificationsOff"} />
                    {remindersEnabled ? "Reminders enabled" : "Reminders off"}
                  </span>
                  <span aria-hidden="true" className="settings-space-status__sep">·</span>
                  <span className="settings-space-status__item">
                    <Image alt="" aria-hidden={true} height={16} src="/icons/google_calendar_icon.svg" width={16} />
                    {googleCalendarConnected ? "Google Calendar connected" : "Google Calendar not connected"}
                  </span>
                </div>
              </div>
              <SpaceSettingsMenu action={isOwner ? "delete" : "leave"} vaultId={selectedVault.id} />
            </section>

            {/* Members */}
            <section className="settings-card">
              <div className="settings-card__header">
                <div>
                  <h2>Members</h2>
                  <p className="muted">People who have access to this space.</p>
                </div>
                {isOwner ? <InviteMemberAction vaultId={selectedVault.id} /> : null}
              </div>
              <div className="settings-member-list">
                {selectedVault.memberships.map((membership) => {
                  const isManageable =
                    isOwner && membership.role !== "owner" && membership.user.id !== user.id;

                  return (
                    <div className="member-row" key={membership.user.id}>
                      <div className="member-info">
                        <Avatar
                          className={membership.role !== "owner" ? "avatar-chip--soft" : undefined}
                          email={membership.user.email}
                          imageUrl={membership.user.image}
                          name={membership.user.name}
                        />
                        <div>
                          <strong>{membership.user.name ?? membership.user.email}</strong>
                          {membership.user.name && membership.user.name !== membership.user.email ? (
                            <p className="muted">{membership.user.email}</p>
                          ) : null}
                        </div>
                      </div>
                      {isManageable ? (
                        <MemberActions
                          initialRole={membership.role as "editor" | "member"}
                          memberId={membership.user.id}
                          vaultId={selectedVault.id}
                        />
                      ) : (
                        <>
                          <div className="member-role-col">
                            <span className="member-role" data-role={membership.role}>{getRoleLabel(membership.role)}</span>
                          </div>
                          <div className="member-actions-col" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Invitations */}
            <section className="settings-card">
              <div className="settings-card__header">
                <div>
                  <h2>Invitations</h2>
                  <p className="muted">Email invitations sent to people.</p>
                </div>
              </div>
              {isOwner ? <GenerateLinkAction vaultId={selectedVault.id} /> : null}
              <div className="settings-invite-list">
                {visibleInvites.length > 0 ? (
                  visibleInvites.map((invite) => (
                    <InviteListItem invite={invite} key={invite.id} vaultId={selectedVault.id} />
                  ))
                ) : (
                  <p className="muted settings-invite-empty">No invitations sent yet.</p>
                )}
              </div>
              {inviteListData.length > 3 ? (
                <InvitesDialog invites={inviteListData} vaultId={selectedVault.id} />
              ) : null}
            </section>

            {/* Preferences */}
            <section className="settings-card">
              <div className="settings-card__header">
                <div>
                  <h2>Preferences</h2>
                  <p className="muted">Manage how this space integrates with your tools.</p>
                </div>
              </div>
              <div className="settings-preference-list">
                <div className="preference-row">
                  <div className="preference-icon">
                    <Icon name="calendarDots" />
                  </div>
                  <NotificationSettingForm
                    description="Send watering reminders for plants in this space"
                    endpoint={`/api/vault/${selectedVault.id}/notifications`}
                    initialEmailEnabled={remindersEnabled}
                    label="Space reminders"
                    variant="switch"
                  />
                </div>
                <div className="preference-row">
                  <div className="preference-icon">
                    <Image alt="" aria-hidden={true} height={16} src="/icons/google_calendar_icon.svg" width={16} />
                  </div>
                  <div className="setting-row preference-setting-row">
                    <div>
                      <strong>Google Calendar</strong>
                      <p className="muted">Mirror daily watering reminders as all-day events</p>
                    </div>
                    <div className="inline-actions">
                      {googleCalendarConnected ? (
                        <>
                          <span className="gc-connected-label">
                            <Icon name="saveFill" />
                            Connected
                          </span>
                          <GoogleCalendarDisconnectButton />
                        </>
                      ) : (
                        <GoogleCalendarConnectButton callbackUrl={googleCalendarCallbackUrl} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Right column ─────────────────────────────── */}
          <aside className="settings-aside">

            {/* Space overview */}
            <section className="settings-card settings-overview">
              <div className="settings-card__header">
                <div>
                  <h2>Space overview</h2>
                  <p className="muted">At a glance summary of your space.</p>
                </div>
              </div>
              <div className="overview-tiles">
                <div className="overview-tile">
                  <span className="overview-tile__icon">
                    <Icon name="leafFill" />
                  </span>
                  <div className="overview-tile__body">
                    <strong>{plantCount}</strong>
                    <span>Plants</span>
                  </div>
                </div>
                <div className="overview-tile">
                  <span className="overview-tile__icon">
                    <Icon name="usersFill" />
                  </span>
                  <div className="overview-tile__body">
                    <strong>{memberCount}</strong>
                    <span>Members</span>
                  </div>
                </div>
                <div className="overview-tile">
                  <span className="overview-tile__icon">
                    <Icon name="notificationFill" />
                  </span>
                  <div className="overview-tile__body">
                    <span className="overview-tile__label">Reminders</span>
                    <strong>{remindersEnabled ? "On" : "Off"}</strong>
                  </div>
                </div>
                <div className="overview-tile">
                  <span className="overview-tile__icon">
                    <Icon name="calendarFill" />
                  </span>
                  <div className="overview-tile__body">
                    <span className="overview-tile__label">Calendar</span>
                    <strong>{googleCalendarConnected ? "Connected" : "Not connected"}</strong>
                  </div>
                </div>
              </div>
              <div className="settings-overview__accent" aria-hidden="true">
                <Icon name="plantFill" />
              </div>
            </section>

            {/* Quick actions */}
            {(userCanManagePlants || isOwner) ? (
              <section className="settings-card settings-quick-actions">
                <div className="settings-card__header">
                  <div>
                    <h2>Quick actions</h2>
                    <p className="muted">Shortcuts to common tasks.</p>
                  </div>
                </div>
                <div className="settings-quick-actions__list">
                  {userCanManagePlants ? (
                    <Link className={buttonClassName({ variant: "primary" })} href={addPlantHref}>
                      <Icon className="ui-button__icon" name="add" />
                      <span className="ui-button__label">Add plant</span>
                    </Link>
                  ) : null}
                  {isOwner ? (
                    <InviteMemberAction variant="subtle" vaultId={selectedVault.id} />
                  ) : null}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
