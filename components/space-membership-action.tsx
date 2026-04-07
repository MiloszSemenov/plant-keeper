"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";

export function SpaceMembershipAction({
  vaultId,
  action
}: {
  vaultId: string;
  action: "delete" | "leave";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isDeleteAction = action === "delete";
  const buttonLabel = isDeleteAction ? "Delete space" : "Leave space";
  const confirmMessage = isDeleteAction
    ? "Delete this space and all of its plants, reminders, and invites?"
    : "Leave this space?";

  return (
    <button
      className={buttonClassName({
        variant: isDeleteAction ? "danger" : "ghost"
      })}
      disabled={isPending}
      onClick={() => {
        if (!window.confirm(confirmMessage)) {
          return;
        }

        startTransition(async () => {
          const response = await fetch(`/api/vault/${vaultId}`, {
            method: "DELETE"
          });

          const payload = await response
            .json()
            .catch(() => ({ error: `Unable to ${action} space` }));

          if (!response.ok) {
            window.alert(payload.error ?? `Unable to ${action} space`);
            return;
          }

          router.push("/dashboard");
          router.refresh();
        });
      }}
      type="button"
    >
      {isPending ? "Updating..." : buttonLabel}
    </button>
  );
}
