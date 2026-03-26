"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function ManageInviteButton({
  vaultId,
  inviteId,
  label
}: {
  vaultId: string;
  inviteId: string;
  label: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      aria-label={label}
      className="button button-ghost icon-button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/vault/${vaultId}/invite/${inviteId}`, {
            method: "DELETE"
          });

          const payload = await response.json().catch(() => ({ error: "Unable to update invite" }));

          if (!response.ok) {
            window.alert(payload.error ?? "Unable to update invite");
            return;
          }

          router.refresh();
        });
      }}
      title={label}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path
          d="M4 7h16M9 7V5h6v2m-8 0 1 12h8l1-12"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </button>
  );
}
