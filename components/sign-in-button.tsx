"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

export function SignInButton({
  className,
  callbackUrl = "/dashboard",
  label = "Continue with Google"
}: {
  className?: string;
  callbackUrl?: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={cn("button button-primary", className)}
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          void signIn("google", { callbackUrl });
        });
      }}
      type="button"
    >
      <span className="google-mark" aria-hidden="true">
        G
      </span>
      {isPending ? "Connecting..." : label}
    </button>
  );
}
