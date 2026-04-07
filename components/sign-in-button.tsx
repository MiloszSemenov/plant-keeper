"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";
import { buttonClassName, type ButtonSize } from "@/components/ui/button";

export function SignInButton({
  className,
  size = "md",
  callbackUrl = "/dashboard",
  label = "Continue with Google"
}: {
  className?: string;
  size?: ButtonSize;
  callbackUrl?: string;
  label?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={buttonClassName({
        className,
        size,
        variant: "primary"
      })}
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
