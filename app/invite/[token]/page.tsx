import Link from "next/link";
import { auth } from "@/auth";
import { AcceptInviteButton } from "@/components/accept-invite-button";
import { DeclineInviteButton } from "@/components/decline-invite-button";
import { SignInButton } from "@/components/sign-in-button";
import { Avatar } from "@/components/ui/avatar";
import { buttonClassName } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { getInviteByToken } from "@/services/invites";
import { formatDate } from "@/lib/time";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

function InviteBrand() {
  return (
    <span className="invite-brand">
      <span className="invite-brand__mark">
        <Icon name="leafFill" />
      </span>
      PlantKeeper
    </span>
  );
}

export default async function InvitePage({ params }: InvitePageProps) {
  const session = await auth();
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="invite-page">
        <section className="invite-card">
          <InviteBrand />
          <div className="invite-state-icon">
            <Icon name="close" />
          </div>
          <div className="invite-heading">
            <h1 className="invite-card__title">Invite not found</h1>
            <p className="invite-card__lead">This invite link is invalid or has already been removed.</p>
          </div>
          <Link className={buttonClassName({ variant: "subtle" })} href="/">
            Back to PlantKeeper
          </Link>
        </section>
      </main>
    );
  }

  const inviterName = invite.createdBy.name ?? invite.createdBy.email;
  const plantCount = invite.vault._count.plants;
  const memberCount = invite.vault._count.memberships;
  const members = invite.vault.memberships;
  const extraMembers = Math.max(memberCount - members.length, 0);
  const isWaiting = invite.status === "waiting";

  return (
    <main className="invite-page">
      <section className="invite-card">
        <InviteBrand />

        <div className="invite-heading">
          <p className="eyebrow">Space invite</p>
          <h1 className="invite-card__title">
            You&rsquo;re invited to join
            <br />
            <span className="invite-card__space">{invite.vault.name}</span>
          </h1>
        </div>

        <p className="invite-inviter">
          <Avatar
            email={invite.createdBy.email}
            imageUrl={invite.createdBy.image}
            name={invite.createdBy.name}
          />
          <span>
            <strong>{inviterName}</strong> invited you to this shared space.
          </span>
        </p>

        <div className="invite-space-summary">
          <div className="invite-stats">
            <span className="invite-stat">
              <Icon name="plant" />
              {plantCount} {plantCount === 1 ? "plant" : "plants"}
            </span>
            <span className="invite-stat">
              <Icon name="usersFill" />
              {memberCount} {memberCount === 1 ? "member" : "members"}
            </span>
          </div>
          {members.length > 0 ? (
            <div className="avatar-cluster">
              {members.map((membership) => (
                <Avatar
                  className="avatar-chip--soft"
                  email={membership.user.email}
                  imageUrl={membership.user.image}
                  key={membership.user.id}
                  name={membership.user.name}
                />
              ))}
              {extraMembers > 0 ? (
                <span className="avatar-chip avatar-chip--count">+{extraMembers}</span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="invite-actions">
          {invite.status === "joined" ? (
            <>
              <p className="invite-status invite-status--success">
                <Icon name="check" />
                You&rsquo;re already part of this space.
              </p>
              <Link
                className={buttonClassName({ variant: "primary" })}
                href={`/dashboard?vaultId=${invite.vault.id}`}
              >
                Go to dashboard
              </Link>
            </>
          ) : invite.status === "declined" ? (
            <p className="invite-status invite-status--error">
              <Icon name="close" />
              This invite was declined and can no longer be used.
            </p>
          ) : invite.status === "expired" ? (
            <p className="invite-status invite-status--error">
              <Icon name="close" />
              This invite has expired.
            </p>
          ) : session?.user?.id ? (
            <>
              <AcceptInviteButton label="Join space" token={token} />
              <DeclineInviteButton token={token} />
            </>
          ) : (
            <>
              <SignInButton callbackUrl={`/invite/${token}`} label="Sign in to join" variant="primary" />
              <DeclineInviteButton token={token} />
            </>
          )}
        </div>

        {isWaiting || invite.email ? (
          <p className="invite-meta">
            {isWaiting ? `Expires ${formatDate(invite.expiresAt)}` : null}
            {isWaiting && invite.email ? " · " : null}
            {invite.email ? `Reserved for ${invite.email}` : null}
          </p>
        ) : null}
      </section>
    </main>
  );
}
