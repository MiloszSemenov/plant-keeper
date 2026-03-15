"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function MarkWateredButton({
  plantId,
  className
}: {
  plantId: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={cn("button button-primary", className)}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = await fetch(`/api/plants/${plantId}/water`, {
            method: "POST"
          });

          if (!response.ok) {
            const payload = await response.json().catch(() => ({ error: "Unable to update plant" }));
            window.alert(payload.error ?? "Unable to update plant");
            return;
          }

          router.refresh();
        });
      }}
      type="button"
    >
      {isPending ? "Updating..." : "Mark watered"}
    </button>
  );
}
