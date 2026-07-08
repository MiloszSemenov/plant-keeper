"use client";

import { useState, useTransition, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailSignInForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();

    if (!trimmed) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const response = await signIn("resend", {
        email: trimmed,
        callbackUrl,
        redirect: false
      });

      if (response?.error) {
        setError("We couldn't send the link. Check the address and try again.");
        return;
      }

      setSentTo(trimmed);
    });
  }

  if (sentTo) {
    return (
      <div className="signin-sent" role="status">
        <p className="signin-sent__title">Check your inbox</p>
        <p className="signin-sent__lead">
          We sent a sign-in link to <strong>{sentTo}</strong>. It expires in 1 hour.
        </p>
        <Button
          onClick={() => {
            setSentTo(null);
            setEmail("");
          }}
          size="text"
          type="button"
          variant="ghost"
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <form className="signin-email-form" onSubmit={handleSubmit}>
      <Input
        aria-label="Email address"
        autoComplete="email"
        name="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
        type="email"
        value={email}
      />
      {error ? <p className="signin-error">{error}</p> : null}
      <Button disabled={isPending} size="lg" type="submit" variant="subtle">
        {isPending ? "Sending link..." : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
