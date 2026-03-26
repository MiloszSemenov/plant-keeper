import { auth } from "@/auth";
import { AcceptInviteButton } from "@/components/accept-invite-button";
import { DeclineInviteButton } from "@/components/decline-invite-button";
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

  return (
    <main className="marketing-shell">
      <section className="marketing-hero panel">
        <div className="stack-md">
          <p className="eyebrow">Join space</p>
          <h1>{invite ? `Join "${invite.vault.name}"?` : "Join a shared plant space"}</h1>
          <p>
            {invite
              ? "This invite code unlocks a shared space in Plant Keeper."
              : "Paste an invite code to join a shared space."}
          </p>
          {!invite ? <JoinSpaceForm initialCode={code} /> : null}
          {code ? (
            invite ? (
              <div className="stack-xs">
                <p className="muted">Expires {formatDate(invite.expiresAt)}</p>
                {invite.email ? <p className="muted">Reserved for {invite.email}</p> : null}
                {invite.status === "joined" ? (
                  <p className="field-success">This invite has already been accepted.</p>
                ) : invite.status === "declined" ? (
                  <p className="field-error">This invite was declined and can no longer be used.</p>
                ) : invite.status === "expired" ? (
                  <p className="field-error">This invite has expired.</p>
                ) : session?.user?.id ? (
                  <div className="inline-actions">
                    <AcceptInviteButton code={code} label="Join" />
                    <DeclineInviteButton code={code} />
                  </div>
                ) : (
                  <div className="inline-actions">
                    <SignInButton callbackUrl={`/join?code=${code}`} label="Sign in to join" />
                    <DeclineInviteButton code={code} />
                  </div>
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
