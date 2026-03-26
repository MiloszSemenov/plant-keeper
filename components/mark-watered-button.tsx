"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type DashboardWateringAction = {
  vaultId: string;
  section: "overdue" | "today" | "upcoming";
  devMode?: boolean;
  dayOffset?: number;
};

export function MarkWateredButton({
  plantId,
  className,
  label,
  dashboardAction
}: {
  plantId?: string;
  className?: string;
  label?: string;
  dashboardAction?: DashboardWateringAction;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={cn("button button-primary", className)}
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          const response = dashboardAction
            ? await fetch("/api/plants/dashboard", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({
                  vaultId: dashboardAction.vaultId,
                  section: dashboardAction.section,
                  devMode: dashboardAction.devMode ? "true" : undefined,
                  dayOffset:
                    dashboardAction.dayOffset === undefined
                      ? undefined
                      : String(dashboardAction.dayOffset)
                })
              })
            : await fetch(`/api/plants/${plantId}/water`, {
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
      {isPending ? "Updating..." : label ?? (dashboardAction ? "Mark all watered" : "Mark watered")}
    </button>
  );
}
