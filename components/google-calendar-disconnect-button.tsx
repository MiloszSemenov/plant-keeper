"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { buttonClassName } from "@/components/ui/button";

export function GoogleCalendarDisconnectButton() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function disconnect() {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/google-calendar", {
        method: "DELETE"
      });
      const payload = await response
        .json()
        .catch(() => ({ error: "Unable to disconnect Google Calendar" }));

      if (!response.ok) {
        setError(payload.error ?? "Unable to disconnect Google Calendar");
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="stack-xs">
      <button
        className={buttonClassName({
          variant: "ghost"
        })}
        disabled={isPending}
        onClick={disconnect}
        type="button"
      >
        {isPending ? "Disconnecting..." : "Disconnect"}
      </button>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}
