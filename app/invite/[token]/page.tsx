import { auth } from "@/auth";
import { AcceptInviteButton } from "@/components/accept-invite-button";
import { SignInButton } from "@/components/sign-in-button";
import { getInviteByToken } from "@/services/invites";
import { formatDate } from "@/lib/time";

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function InvitePage({ params }: InvitePageProps) {
  const session = await auth();
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return (
      <main className="marketing-shell">
        <section className="panel">
          <h1>Invite not found</h1>
          <p>This invite link is invalid or has already been removed.</p>
        </section>
      </main>
    );
  }

  const isExpired = invite.expiresAt < new Date();
  const isAccepted = Boolean(invite.acceptedAt);

  return (
    <main className="marketing-shell">
      <section className="marketing-hero panel">
        <div className="stack-md">
          <p className="eyebrow">Space invite</p>
          <h1>Join {invite.vault.name}</h1>
          <p>
            {invite.createdBy.name ?? invite.createdBy.email} invited you to collaborate on this
            shared plant space.
          </p>
          <div className="stack-xs">
            <p className="muted">Expires {formatDate(invite.expiresAt)}</p>
            {invite.email ? <p className="muted">Reserved for {invite.email}</p> : null}
          </div>
          {isAccepted ? (
            <p className="field-success">This invite has already been accepted.</p>
          ) : isExpired ? (
            <p className="field-error">This invite has expired.</p>
          ) : session?.user?.id ? (
            <AcceptInviteButton token={token} />
          ) : (
            <SignInButton callbackUrl={`/invite/${token}`} label="Sign in to accept invite" />
          )}
        </div>
      </section>
    </main>
  );
}
