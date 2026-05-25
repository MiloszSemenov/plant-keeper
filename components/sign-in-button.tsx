"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

export function SignInButton({
  className,
  size = "md",
  variant = "primary",
  callbackUrl = "/dashboard",
  label = "Continue with Google",
  showGoogleMark = true
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
  callbackUrl?: string;
  label?: string;
  showGoogleMark?: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={buttonClassName({
        className,
        size,
        variant
      })}
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          void signIn("google", { callbackUrl });
        });
      }}
      type="button"
    >
      {showGoogleMark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" aria-hidden="true" className="google-mark" src="/icons/google.svg" />
      ) : null}
      {isPending ? "Connecting..." : label}
    </button>
  );
}
