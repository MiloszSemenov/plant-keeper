import { formatDate } from "@/lib/time";
import { ManageInviteButton } from "@/components/manage-invite-button";
import type { VaultInviteStatus } from "@/services/invites";

export type InviteForSettings = {
  id: string;
  email: string | null;
  status: VaultInviteStatus;
  expiresAt: Date;
  createdBy: { name: string | null; email: string };
  acceptedBy: { name: string | null; email: string } | null;
};

export function getInviteStatusPresentation(status: VaultInviteStatus) {
  if (status === "joined") {
    return { label: "Joined", tone: "success" };
  }
  if (status === "declined") {
    return { label: "Declined", tone: "danger" };
  }
  if (status === "expired") {
    return { label: "Expired", tone: "neutral" };
  }
  return { label: "Waiting", tone: "warning" };
}

export function InviteListItem({
  invite,
  vaultId
}: {
  invite: InviteForSettings;
  vaultId: string;
}) {
  const presentation = getInviteStatusPresentation(invite.status);
  const joinedBy =
    invite.status === "joined" && invite.acceptedBy
      ? `Joined by ${invite.acceptedBy.name ?? invite.acceptedBy.email}`
      : null;

  return (
    <div className="settings-invite-item settings-row">
      <div className="settings-invite-item__identity">
        <strong>{invite.email}</strong>
      </div>
      <div className="muted settings-invite-item__meta">
        <p>Invited by {invite.createdBy.name ?? invite.createdBy.email}</p>
        {invite.status === "waiting" ? <p>Expires {formatDate(invite.expiresAt)}</p> : null}
        {joinedBy ? (
          <p>
            <strong>{joinedBy}</strong>
          </p>
        ) : null}
      </div>
      <div className="settings-invite-item__actions">
        <span className={`status-pill status-${presentation.tone}`}>{presentation.label}</span>
        <ManageInviteButton
          inviteId={invite.id}
          label={invite.status === "waiting" ? "Revoke invite" : "Remove invite"}
          vaultId={vaultId}
        />
      </div>
    </div>
  );
}
