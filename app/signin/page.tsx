import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { EmailSignInForm } from "@/components/email-sign-in-form";
import { SignInButton } from "@/components/sign-in-button";
import { Icon } from "@/components/ui/icon";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    callbackUrl?: string;
  }>;
};

function errorMessage(error: string | undefined) {
  if (!error) {
    return null;
  }

  if (error === "Verification") {
    return "That sign-in link has expired or was already used. Request a fresh one below.";
  }

  return "Something went wrong while signing you in. Please try again.";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await auth();

  if (session?.user?.id) {
    redirect("/dashboard");
  }

  const { error, callbackUrl } = await searchParams;
  const message = errorMessage(error);
  const safeCallbackUrl = callbackUrl?.startsWith("/") ? callbackUrl : "/dashboard";

  return (
    <main className="invite-page">
      <section className="invite-card">
        <span className="invite-brand">
          <span className="invite-brand__mark">
            <Icon name="leafFill" />
          </span>
          PlantKeeper
        </span>

        <div className="invite-heading">
          <h1 className="invite-card__title">Welcome back</h1>
          <p className="invite-card__lead">Sign in to keep your plants happy.</p>
        </div>

        {message ? (
          <p className="signin-error" role="alert">
            {message}
          </p>
        ) : null}

        <div className="signin-methods">
          <SignInButton callbackUrl={safeCallbackUrl} className="signin-google" size="lg" />

          <div className="landing-or-divider" role="separator">
            <span />
            <span>or</span>
            <span />
          </div>

          <EmailSignInForm callbackUrl={safeCallbackUrl} />
        </div>

        <Link className="signin-back" href="/">
          Back to home
        </Link>
      </section>
    </main>
  );
}
