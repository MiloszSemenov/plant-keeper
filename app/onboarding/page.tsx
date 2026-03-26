import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { listUserVaults } from "@/services/vaults";
import { CreateVaultForm } from "@/components/create-vault-form";
import { JoinSpaceForm } from "@/components/join-space-form";

export default async function OnboardingPage() {
  const user = await requireUser();
  const memberships = await listUserVaults(user.id);

  if (memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="marketing-shell">
      <section className="marketing-hero panel">
        <div className="stack-md">
          <p className="eyebrow">Welcome</p>
          <h1>Let&apos;s set up your first space</h1>
          <p>Create a new space or join an existing one to start tracking shared plant care.</p>
        </div>
      </section>

      <section className="settings-grid">
        <article className="panel stack-sm">
          <p className="eyebrow">Create</p>
          <h2>Start a new space</h2>
          <p className="muted">Set up a shared home for plants, reminders, and members.</p>
          <CreateVaultForm />
        </article>

        <article className="panel stack-sm">
          <p className="eyebrow">Join</p>
          <h2>Use an invite code</h2>
          <p className="muted">Already invited? Paste the code and confirm the space to join.</p>
          <JoinSpaceForm />
        </article>
      </section>
    </main>
  );
}
