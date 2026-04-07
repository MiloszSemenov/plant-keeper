"use client";

import { useTransition } from "react";
import { signOut } from "next-auth/react";
import { buttonClassName, type ButtonSize, type ButtonVariant } from "@/components/ui/button";

export function SignOutButton({
  className,
  size = "sm",
  variant = "subtle"
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
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
          void signOut({ callbackUrl: "/" });
        });
      }}
      type="button"
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
