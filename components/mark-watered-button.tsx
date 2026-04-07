"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  buttonClassName,
  type ButtonSize,
  type ButtonVariant
} from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
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
  dashboardAction,
  icon,
  iconOnly = false,
  size = "md",
  variant = "primary"
}: {
  plantId?: string;
  className?: string;
  label?: string;
  dashboardAction?: DashboardWateringAction;
  icon?: IconName;
  iconOnly?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const buttonLabel =
    label ?? (dashboardAction ? "Mark all watered" : "Mark watered");
  const pendingLabel = isPending ? "Updating..." : buttonLabel;

  return (
    <button
      aria-label={iconOnly ? pendingLabel : undefined}
      className={cn(
        buttonClassName({
          className,
          iconOnly,
          size,
          variant
        }),
        "button",
        `button-${variant}`
      )}
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
      {icon ? <Icon className="ui-button__icon" name={icon} /> : null}
      {iconOnly ? <span className="sr-only">{pendingLabel}</span> : pendingLabel}
    </button>
  );
}
