"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function AcceptInviteButton({
  token,
  code,
  label = "Accept invite"
}: {
  token?: string;
  code?: string;
  label?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const errorMessage = token ? "Unable to accept invite" : "Unable to join space";

  return (
    <button
      className="button button-primary"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = token
            ? await fetch(`/api/invite/${token}/accept`, {
                method: "POST"
              })
            : await fetch("/api/join", {
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

          router.push(`/dashboard?vaultId=${payload.vault.id}`);
          router.refresh();
        });
      }}
      type="button"
    >
      {isPending ? "Joining..." : label}
    </button>
  );
}
