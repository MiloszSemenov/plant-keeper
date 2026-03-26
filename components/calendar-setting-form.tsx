"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export function CalendarSettingForm({
  endpoint,
  initialCalendarEnabled,
  label,
  description,
  disabled = false
}: {
  endpoint: string;
  initialCalendarEnabled: boolean;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [calendarEnabled, setCalendarEnabled] = useState(initialCalendarEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSetting(nextValue: boolean) {
    const previousValue = calendarEnabled;
    setError(null);
    setCalendarEnabled(nextValue);

    startTransition(async () => {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          calendarEnabled: nextValue
        })
      });

      const payload = await response
        .json()
        .catch(() => ({ error: "Unable to update calendar reminders" }));

      if (!response.ok) {
        setCalendarEnabled(previousValue);
        setError(payload.error ?? "Unable to update calendar reminders");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="stack-sm">
      <div className="setting-row">
        <div>
          <strong>{label}</strong>
          {description ? <p>{description}</p> : null}
        </div>
        <button
          aria-checked={calendarEnabled}
          aria-label={label}
          className={cn("setting-switch", calendarEnabled && "active")}
          disabled={disabled || isPending}
          onClick={() => updateSetting(!calendarEnabled)}
          role="switch"
          type="button"
        >
          <span className="setting-switch-thumb" />
        </button>
      </div>
      {disabled ? <p className="muted">Connect Google Calendar first.</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
