"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

function buildDashboardHref(vaultId: string, dayOffset: number) {
  return `/dashboard?vaultId=${vaultId}&devMode=true&dayOffset=${dayOffset}`;
}

export function DevModePanel({
  vaultId,
  dayOffset
}: {
  vaultId: string;
  dayOffset: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <section className="panel stack-sm">
      <div>
        <p className="eyebrow">Dev mode</p>
        <h2>Simulate plant states</h2>
        <p>
          Shift the dashboard date to preview overdue, due today, and upcoming states without
          changing real data.
        </p>
      </div>

      <div className="dev-links">
        {[
          { label: "Past 3 days", value: -3 },
          { label: "Today", value: 0 },
          { label: "Tomorrow", value: 1 },
          { label: "In 3 days", value: 3 },
          { label: "In 7 days", value: 7 }
        ].map((option) => (
          <Link
            className={option.value === dayOffset ? "dev-chip active" : "dev-chip"}
            href={buildDashboardHref(vaultId, option.value)}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
        <Link className="dev-chip" href={`/dashboard?vaultId=${vaultId}`}>
          Exit dev mode
        </Link>
      </div>

      <div className="inline-actions">
        <button
          className="button button-secondary"
          disabled={isPending}
          onClick={() => {
            setError(null);
            setSummary(null);

            startTransition(async () => {
              const response = await fetch(
                `/api/dev/reminders?dayOffset=${dayOffset}&forceCalendar=true&overdue=true`,
                {
                  method: "POST"
                }
              );

              const payload = await response
                .json()
                .catch(() => ({ error: "Unable to run reminder test" }));

              if (!response.ok) {
                setError(payload.error ?? "Unable to run reminder test");
                return;
              }

              const calendarSummary = payload.calendar
                ? ` Calendar sync: integrations ${payload.calendar.integrations}, created ${payload.calendar.created}, kept ${payload.calendar.kept}, deleted ${payload.calendar.deleted}, failed ${payload.calendar.failed}.`
                : "";

              setSummary(
                `Eligible plants ${payload.duePlants}, recipients ${payload.recipients}, sent ${payload.sent}, skipped ${payload.skipped}, failed ${payload.failed}.${calendarSummary}`
              );
            });
          }}
          type="button"
        >
          {isPending ? "Testing..." : "Test reminders + calendar"}
        </button>
        <p className="muted">Current offset: {dayOffset} days. Calendar sync stays log-only in dev mode.</p>
      </div>

      {error ? <p className="field-error">{error}</p> : null}
      {summary ? <p className="field-success">{summary}</p> : null}
    </section>
  );
}
