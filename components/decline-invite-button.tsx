"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function DeclineInviteButton({
  token,
  code,
  label = "Decline"
}: {
  token?: string;
  code?: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const errorMessage = token ? "Unable to decline invite" : "Unable to decline join request";

  return (
    <button
      className="button button-ghost"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = token
            ? await fetch(`/api/invite/${token}/decline`, {
                method: "POST"
              })
            : await fetch("/api/join/decline", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ code })
              });

          const payload = await response.json().catch(() => ({ error: errorMessage }));

          if (!response.ok) {
            window.alert(payload.error ?? errorMessage);
            return;
          }

          router.refresh();
        });
      }}
      type="button"
    >
      {isPending ? "Declining..." : label}
    </button>
  );
}
