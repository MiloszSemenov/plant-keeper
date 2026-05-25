"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  buttonClassName,
  type ButtonSize,
  type ButtonVariant
} from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";

export function MarkWateredButton({
  plantId,
  className,
  label,
  icon,
  iconOnly = false,
  size = "md",
  variant = "primary"
}: {
  plantId?: string;
  className?: string;
  label?: string;
  icon?: IconName;
  iconOnly?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  const [isPending, setIsPending] = useState(false);
  const buttonLabel = label ?? "Mark watered";
  const pendingLabel = isPending ? "Updating..." : buttonLabel;

  async function waterPlant() {
    if (!plantId || isPending) {
      return;
    }

    setIsPending(true);

    try {
      const response = await fetch(`/api/plants/${plantId}/water`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ wateredAt: new Date().toISOString() })
      });

      if (!response.ok) {
        throw new Error("Unable to update plant");
      }

      toast.success("Plant marked watered");
    } catch {
      toast.error("There was a problem watering your plant");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      aria-label={iconOnly ? pendingLabel : undefined}
      className={buttonClassName({
        className,
        iconOnly,
        size,
        variant
      })}
      disabled={isPending}
      onClick={waterPlant}
      type="button"
    >
      {icon ? <Icon className="ui-button__icon" name={icon} /> : null}
      <span className={iconOnly ? "sr-only ui-button__label" : "ui-button__label"}>
        {pendingLabel}
      </span>
    </button>
  );
}
