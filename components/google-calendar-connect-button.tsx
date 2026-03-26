"use client";

import { useTransition } from "react";
import { signIn } from "next-auth/react";
import { cn } from "@/lib/utils";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

export function GoogleCalendarConnectButton({
  callbackUrl,
  className
}: {
  callbackUrl: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={cn("button button-primary", className)}
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          void signIn(
            "google",
            {
              callbackUrl
            },
            {
              scope: `openid email profile ${GOOGLE_CALENDAR_SCOPE}`,
              prompt: "consent",
              access_type: "offline",
              include_granted_scopes: "true"
            }
          );
        });
      }}
      type="button"
    >
      {isPending ? "Connecting..." : "Connect Google Calendar"}
    </button>
  );
}
