"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function NotificationSettingForm({
  endpoint,
  label,
  description,
  initialEmailEnabled,
  variant = "switch"
}: {
  endpoint: string;
  label: string;
  description?: string;
  initialEmailEnabled: boolean;
  variant?: "bell" | "switch";
}) {
  const router = useRouter();
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSetting(nextValue: boolean) {
    const previousValue = emailEnabled;
    setError(null);
    setEmailEnabled(nextValue);

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          emailEnabled: nextValue,
          pushEnabled: false
        })
      });

      const payload = await response
        .json()
        .catch(() => ({ error: "Unable to update notification settings" }));

      if (!response.ok) {
        setEmailEnabled(previousValue);
        setError(payload.error ?? "Unable to update notification settings");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="stack-sm">
      {variant === "bell" ? (
        <button
          aria-pressed={emailEnabled}
          className={cn("notification-bell", emailEnabled && "active")}
          disabled={isPending}
          onClick={() => updateSetting(!emailEnabled)}
          type="button"
        >
          <span aria-hidden="true" className="notification-bell-icon">
            {"\uD83D\uDD14"}
          </span>
          <span>{label}</span>
        </button>
      ) : (
        <div className="setting-row">
          <div>
            <strong>{label}</strong>
            {description ? <p>{description}</p> : null}
          </div>
          <button
            aria-checked={emailEnabled}
            aria-label={label}
            className={cn("setting-switch", emailEnabled && "active")}
            disabled={isPending}
            onClick={() => updateSetting(!emailEnabled)}
            role="switch"
            type="button"
          >
            <span className="setting-switch-thumb" />
          </button>
        </div>
      )}
      {variant === "bell" ? (
        <p className="muted">{isPending ? "Updating..." : emailEnabled ? "On" : "Off"}</p>
      ) : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
