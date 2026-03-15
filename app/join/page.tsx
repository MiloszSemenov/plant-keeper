import { auth } from "@/auth";
import { AcceptInviteButton } from "@/components/accept-invite-button";
import { JoinSpaceForm } from "@/components/join-space-form";
import { SignInButton } from "@/components/sign-in-button";
import { formatDate } from "@/lib/time";
import { getInviteByCode } from "@/services/invites";

type JoinPageProps = {
  searchParams: Promise<{
    code?: string;
  }>;
};

export default async function JoinPage({ searchParams }: JoinPageProps) {
  const session = await auth();
  const params = await searchParams;
  const code = params.code?.trim().toUpperCase() ?? "";
  const invite = code ? await getInviteByCode(code) : null;
  const isExpired = invite ? invite.expiresAt < new Date() : false;
  const isAccepted = Boolean(invite?.acceptedAt);

  return (
    <main className="marketing-shell">
      <section className="marketing-hero panel">
        <div className="stack-md">
          <p className="eyebrow">Join space</p>
          <h1>Join a shared plant space</h1>
          <p>Paste an invite code or open a join link to become a member of a shared space.</p>
          <JoinSpaceForm initialCode={code} />
          {code ? (
            invite ? (
              <div className="stack-xs">
                <p className="muted">Code: {code}</p>
                <p className="muted">Space: {invite.vault.name}</p>
                <p className="muted">Expires {formatDate(invite.expiresAt)}</p>
                {isAccepted ? (
                  <p className="field-success">This invite has already been accepted.</p>
                ) : isExpired ? (
                  <p className="field-error">This invite has expired.</p>
                ) : session?.user?.id ? (
                  <AcceptInviteButton code={code} label="Join space" />
                ) : (
                  <SignInButton callbackUrl={`/join?code=${code}`} label="Sign in to join" />
                )}
              </div>
            ) : (
              <p className="field-error">That invite code was not found.</p>
            )
          ) : session?.user?.id ? null : (
            <SignInButton callbackUrl="/join" label="Sign in to join a space" />
          )}
        </div>
      </section>
    </main>
  );
}
