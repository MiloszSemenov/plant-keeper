import { prisma } from "@/db/client";
import { getDevModeState } from "@/lib/dev-mode";
import { getAppUrl, requireEnv } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { addDays, startOfUtcDay } from "@/lib/time";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_PROVIDER = "google";
const DEFAULT_CALENDAR_ID = "primary";
const REMINDER_EVENT_MARKER = "watering_reminder";

type GoogleCalendarIntegrationAccount = {
  provider?: string;
  scope?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
};

type ReminderDuePlant = {
  vault: {
    memberships: Array<{
      userId: string;
    }>;
  };
};

function hasCalendarScope(scope: string | null) {
  return Boolean(scope?.split(" ").includes(GOOGLE_CALENDAR_SCOPE));
}

function formatAllDayDate(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function buildReminderPayload(date: Date) {
  const day = startOfUtcDay(date);

  return {
    summary: "Water your plants",
    description: `Plant Keeper reminder\n${getAppUrl()}/dashboard`,
    start: {
      date: formatAllDayDate(day)
    },
    end: {
      date: formatAllDayDate(addDays(day, 1))
    },
    extendedProperties: {
      private: {
        plantKeeperType: REMINDER_EVENT_MARKER,
        plantKeeperDate: formatAllDayDate(day)
      }
    }
  };
}

export async function syncGoogleCalendarIntegration({
  userId,
  account
}: {
  userId: string;
  account: GoogleCalendarIntegrationAccount;
}) {
  if (account.provider !== GOOGLE_PROVIDER || !hasCalendarScope(account.scope ?? null)) {
    return null;
  }

  const existing = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER
      }
    }
  });

  return prisma.userIntegration.upsert({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER
      }
    },
    update: {
      accessToken: account.access_token ?? existing?.accessToken ?? null,
      refreshToken: account.refresh_token ?? existing?.refreshToken ?? null,
      tokenExpiresAt:
        typeof account.expires_at === "number"
          ? new Date(account.expires_at * 1000)
          : existing?.tokenExpiresAt ?? null,
      calendarId: existing?.calendarId ?? DEFAULT_CALENDAR_ID
    },
    create: {
      userId,
      provider: GOOGLE_PROVIDER,
      accessToken: account.access_token ?? null,
      refreshToken: account.refresh_token ?? null,
      tokenExpiresAt:
        typeof account.expires_at === "number" ? new Date(account.expires_at * 1000) : null,
      calendarId: DEFAULT_CALENDAR_ID
    }
  });
}

async function refreshGoogleAccessToken(integration: {
  id: string;
  refreshToken: string | null;
}) {
  if (!integration.refreshToken) {
    throw new ApiError(400, "Google Calendar is not connected. Reconnect your Google account.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: requireEnv("GOOGLE_CLIENT_ID"),
      client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: integration.refreshToken
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Google token refresh failed: ${text || response.statusText}`);
  }

  const payload = await response.json();

  return prisma.userIntegration.update({
    where: {
      id: integration.id
    },
    data: {
      accessToken: typeof payload.access_token === "string" ? payload.access_token : null,
      refreshToken:
        typeof payload.refresh_token === "string"
          ? payload.refresh_token
          : integration.refreshToken,
      tokenExpiresAt:
        typeof payload.expires_in === "number"
          ? new Date(Date.now() + payload.expires_in * 1000)
          : null
    }
  });
}

async function getGoogleAccessToken(integration: {
  id: string;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
}) {
  const isExpired =
    !integration.accessToken ||
    !integration.tokenExpiresAt ||
    integration.tokenExpiresAt.getTime() <= Date.now() + 60 * 1000;

  if (!isExpired) {
    return integration.accessToken;
  }

  const refreshedIntegration = await refreshGoogleAccessToken(integration);

  if (!refreshedIntegration.accessToken) {
    throw new ApiError(400, "Google Calendar is not connected.");
  }

  return refreshedIntegration.accessToken;
}

async function googleCalendarRequest(
  integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
  },
  path: string,
  options?: RequestInit
) {
  const accessToken = await getGoogleAccessToken(integration);

  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options?.headers ?? {})
    }
  });
}

async function listReminderEvents(
  integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    calendarId: string | null;
  },
  date: Date
) {
  const day = startOfUtcDay(date);
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const params = new URLSearchParams({
    singleEvents: "true",
    timeMin: day.toISOString(),
    timeMax: addDays(day, 1).toISOString(),
    privateExtendedProperty: `plantKeeperType=${REMINDER_EVENT_MARKER}`
  });
  const response = await googleCalendarRequest(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Google Calendar event lookup failed: ${text || response.statusText}`);
  }

  const payload = (await response.json()) as {
    items?: Array<{
      id?: string;
    }>;
  };

  return Array.isArray(payload.items) ? payload.items : [];
}

async function createReminderEvent(
  integration: {
    id: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    calendarId: string | null;
  },
  date: Date
) {
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const response = await googleCalendarRequest(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify(buildReminderPayload(date))
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Google Calendar event creation failed: ${text || response.statusText}`);
  }

  return response.json();
}

async function deleteReminderEvents(
  integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    calendarId: string | null;
  },
  date: Date
) {
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const events = await listReminderEvents(integration, date);
  let deletedCount = 0;

  for (const event of events) {
    if (!event.id) {
      continue;
    }

    const response = await googleCalendarRequest(
      integration,
      `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`,
      {
        method: "DELETE"
      }
    );

    if (!response.ok && response.status !== 404) {
      const text = await response.text();
      throw new ApiError(502, `Google Calendar event deletion failed: ${text || response.statusText}`);
    }

    deletedCount += 1;
  }

  return deletedCount;
}

export async function syncGoogleCalendarReminders({
  duePlants,
  now
}: {
  duePlants: ReminderDuePlant[];
  now?: Date;
}) {
  const date = startOfUtcDay(now ?? new Date());
  const devMode = getDevModeState().enabled;
  const integrations = await prisma.userIntegration.findMany({
    where: {
      provider: GOOGLE_PROVIDER
    }
  });
  const dueUserIds = new Set(
    duePlants.flatMap((plant) => plant.vault.memberships.map((membership) => membership.userId))
  );
  let created = 0;
  let kept = 0;
  let deleted = 0;
  let failed = 0;

  for (const integration of integrations) {
    try {
      if (dueUserIds.has(integration.userId)) {
        if (devMode) {
          console.info(`DEV MODE: Would create calendar event for user ${integration.userId}`);
          kept += 1;
          continue;
        }

        const existingEvents = await listReminderEvents(integration, date);

        if (existingEvents.length > 0) {
          kept += 1;
          continue;
        }

        await createReminderEvent(integration, date);
        created += 1;
        continue;
      }

      if (devMode) {
        continue;
      }

      const deletedCount = await deleteReminderEvents(integration, date);

      if (deletedCount > 0) {
        deleted += 1;
      }
    } catch (error) {
      failed += 1;
      console.error("[google-calendar] sync_failed", {
        userId: integration.userId,
        error: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }

  return {
    integrations: integrations.length,
    created,
    kept,
    deleted,
    failed
  };
}

export async function disconnectGoogleCalendar(userId: string) {
  const integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER
      }
    }
  });

  if (!integration) {
    return {
      disconnected: true
    };
  }

  if (!getDevModeState().enabled) {
    await deleteReminderEvents(integration, new Date()).catch(() => null);
  }

  await prisma.userIntegration.delete({
    where: {
      id: integration.id
    }
  });

  return {
    disconnected: true
  };
}

export function isGoogleCalendarConnected(integration: { provider: string } | null) {
  return integration?.provider === GOOGLE_PROVIDER;
}
