import { prisma } from '@/db/client';
import { getDevModeState } from '@/lib/dev-mode';
import { getAppUrl, requireEnv } from '@/lib/env';
import { ApiError } from '@/lib/http';
import { startOfUtcDay } from '@/lib/time';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const GOOGLE_PROVIDER = 'google';
const DEFAULT_CALENDAR_ID = 'primary';
const REMINDER_EVENT_MARKER = 'watering_reminder';
const DEFAULT_REMINDER_HOUR = 8;
const REMINDER_EVENT_DURATION_MINUTES = 5;
const REMINDER_TIME_ZONE = 'Europe/Warsaw';

type GoogleCalendarIntegrationAccount = {
  provider?: string;
  scope?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  expires_at?: number | null;
};

type GoogleCalendarReminderEvent = {
  id?: string;
};

function hasCalendarScope(scope: string | null) {
  return Boolean(scope?.split(' ').includes(GOOGLE_CALENDAR_SCOPE));
}

function formatAllDayDate(date: Date) {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function getReminderHour() {
  const configuredHour = process.env.REMINDER_HOUR;

  if (!configuredHour) {
    return DEFAULT_REMINDER_HOUR;
  }

  const reminderHour = Number.parseInt(configuredHour, 10);

  if (
    !Number.isInteger(reminderHour) ||
    reminderHour < 0 ||
    reminderHour > 23
  ) {
    console.warn('[google-calendar] invalid_reminder_hour', {
      configuredHour,
      fallbackHour: DEFAULT_REMINDER_HOUR,
    });

    return DEFAULT_REMINDER_HOUR;
  }

  return reminderHour;
}

function formatReminderDateTime(date: Date, hour: number, minute = 0) {
  const day = formatAllDayDate(date);
  const formattedHour = hour.toString().padStart(2, '0');
  const formattedMinute = minute.toString().padStart(2, '0');

  return `${day}T${formattedHour}:${formattedMinute}:00`;
}

function buildReminderPayload(date: Date) {
  const day = startOfUtcDay(date);
  const reminderHour = getReminderHour();
  const startDateTime = formatReminderDateTime(day, reminderHour);
  const endDateTime = formatReminderDateTime(
    day,
    reminderHour,
    REMINDER_EVENT_DURATION_MINUTES,
  );

  return {
    summary: 'Water your plants',
    description: `Plant Keeper reminder\n${getAppUrl()}/dashboard`,
    start: {
      dateTime: startDateTime,
      timeZone: REMINDER_TIME_ZONE,
    },
    end: {
      dateTime: endDateTime,
      timeZone: REMINDER_TIME_ZONE,
    },
    extendedProperties: {
      private: {
        plantKeeperReminder: 'true',
        plantKeeperType: REMINDER_EVENT_MARKER,
        plantKeeperDate: formatAllDayDate(day),
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        {
          method: 'popup',
          minutes: 0,
        },
      ],
    },
  };
}

export async function syncGoogleCalendarIntegration({
  userId,
  account,
}: {
  userId: string;
  account: GoogleCalendarIntegrationAccount;
}) {
  if (
    account.provider !== GOOGLE_PROVIDER ||
    !hasCalendarScope(account.scope ?? null)
  ) {
    return null;
  }

  const existing = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER,
      },
    },
  });

  return prisma.userIntegration.upsert({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER,
      },
    },
    update: {
      accessToken: account.access_token ?? existing?.accessToken ?? null,
      refreshToken: account.refresh_token ?? existing?.refreshToken ?? null,
      tokenExpiresAt:
        typeof account.expires_at === 'number'
          ? new Date(account.expires_at * 1000)
          : (existing?.tokenExpiresAt ?? null),
      calendarId: existing?.calendarId ?? DEFAULT_CALENDAR_ID,
    },
    create: {
      userId,
      provider: GOOGLE_PROVIDER,
      accessToken: account.access_token ?? null,
      refreshToken: account.refresh_token ?? null,
      tokenExpiresAt:
        typeof account.expires_at === 'number'
          ? new Date(account.expires_at * 1000)
          : null,
      calendarId: DEFAULT_CALENDAR_ID,
    },
  });
}

export async function getGoogleCalendarIntegration(userId: string) {
  return prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER,
      },
    },
    select: {
      provider: true,
    },
  });
}

async function refreshGoogleAccessToken(integration: {
  id: string;
  refreshToken: string | null;
}) {
  if (!integration.refreshToken) {
    throw new ApiError(
      400,
      'Google Calendar is not connected. Reconnect your Google account.',
    );
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: requireEnv('GOOGLE_CLIENT_ID'),
      client_secret: requireEnv('GOOGLE_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      502,
      `Google token refresh failed: ${text || response.statusText}`,
    );
  }

  const payload = await response.json();

  return prisma.userIntegration.update({
    where: {
      id: integration.id,
    },
    data: {
      accessToken:
        typeof payload.access_token === 'string' ? payload.access_token : null,
      refreshToken:
        typeof payload.refresh_token === 'string'
          ? payload.refresh_token
          : integration.refreshToken,
      tokenExpiresAt:
        typeof payload.expires_in === 'number'
          ? new Date(Date.now() + payload.expires_in * 1000)
          : null,
    },
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
    throw new ApiError(400, 'Google Calendar is not connected.');
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
  options?: RequestInit,
) {
  const accessToken = await getGoogleAccessToken(integration);

  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(options?.headers ?? {}),
    },
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
) {
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const events: GoogleCalendarReminderEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      maxResults: '250',
    });
    params.append(
      'privateExtendedProperty',
      `plantKeeperType=${REMINDER_EVENT_MARKER}`,
    );

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const response = await googleCalendarRequest(
      integration,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    );

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(
        502,
        `Google Calendar event lookup failed: ${text || response.statusText}`,
      );
    }

    const payload = (await response.json()) as {
      items?: GoogleCalendarReminderEvent[];
      nextPageToken?: string;
    };

    if (Array.isArray(payload.items)) {
      events.push(...payload.items);
    }

    pageToken =
      typeof payload.nextPageToken === 'string'
        ? payload.nextPageToken
        : undefined;
  } while (pageToken);

  return events;
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
  date: Date,
) {
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const response = await googleCalendarRequest(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      body: JSON.stringify(buildReminderPayload(date)),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      502,
      `Google Calendar event creation failed: ${text || response.statusText}`,
    );
  }

  return response.json();
}

async function updateReminderEvent(
  integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    calendarId: string | null;
  },
  eventId: string,
  date: Date,
) {
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const response = await googleCalendarRequest(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(buildReminderPayload(date)),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(
      502,
      `Google Calendar event update failed: ${text || response.statusText}`,
    );
  }

  return response.json();
}

async function deleteReminderEvent(
  integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    calendarId: string | null;
  },
  eventId: string,
) {
  const calendarId = integration.calendarId ?? DEFAULT_CALENDAR_ID;
  const response = await googleCalendarRequest(
    integration,
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
    },
  );

  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new ApiError(
      502,
      `Google Calendar event deletion failed: ${text || response.statusText}`,
    );
  }
}

async function deleteReminderEvents(
  integration: {
    id: string;
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    calendarId: string | null;
  },
) {
  const events = await listReminderEvents(integration);
  let deletedCount = 0;

  for (const event of events) {
    if (!event.id) {
      continue;
    }

    await deleteReminderEvent(integration, event.id);
    deletedCount += 1;
  }

  return deletedCount;
}

export async function syncGoogleCalendarReminders({
  reminderUserIds,
  date,
  forceLog,
}: {
  reminderUserIds: string[];
  date?: Date;
  forceLog?: boolean;
}) {
  const reminderDate = startOfUtcDay(date ?? new Date());
  const reminderDateLabel = formatAllDayDate(reminderDate);
  const devMode = getDevModeState().enabled;
  const integrations = await prisma.userIntegration.findMany({
    where: {
      provider: GOOGLE_PROVIDER,
    },
  });
  const dueUserIds = new Set(reminderUserIds);
  let created = 0;
  let updated = 0;
  let kept = 0;
  let deleted = 0;
  let failed = 0;

  for (const integration of integrations) {
    const shouldHaveReminderEvent = dueUserIds.has(integration.userId);

    try {
      if (devMode && forceLog) {
        console.info('[google-calendar] dev_sync', {
          action: shouldHaveReminderEvent ? 'would_create' : 'would_delete',
          userId: integration.userId,
          date: reminderDateLabel,
        });

        if (shouldHaveReminderEvent) {
          created += 1;
        } else {
          deleted += 1;
        }

        continue;
      }

      if (shouldHaveReminderEvent) {
        if (devMode) {
          console.info('[google-calendar] dev_sync', {
            action: 'would_create',
            userId: integration.userId,
            date: reminderDateLabel,
          });
          kept += 1;
          continue;
        }

        const existingEvents = await listReminderEvents(integration);
        const eventsWithIds = existingEvents.filter(
          (event): event is { id: string } =>
            typeof event.id === 'string' && event.id.length > 0,
        );
        const [eventToUpdate, ...duplicateEvents] = eventsWithIds;

        if (eventToUpdate) {
          await updateReminderEvent(
            integration,
            eventToUpdate.id,
            reminderDate,
          );
          updated += 1;

          if (duplicateEvents.length > 0) {
            for (const duplicateEvent of duplicateEvents) {
              await deleteReminderEvent(integration, duplicateEvent.id);
            }

            deleted += 1;
          }

          continue;
        }

        await createReminderEvent(integration, reminderDate);
        created += 1;
        continue;
      }

      if (devMode) {
        continue;
      }

      const deletedCount = await deleteReminderEvents(integration);

      if (deletedCount > 0) {
        deleted += 1;
      }
    } catch (error) {
      failed += 1;
      console.error('[google-calendar] sync_failed', {
        userId: integration.userId,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  return {
    integrations: integrations.length,
    created,
    updated,
    kept,
    deleted,
    failed,
  };
}

export async function disconnectGoogleCalendar(userId: string) {
  const integration = await prisma.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId,
        provider: GOOGLE_PROVIDER,
      },
    },
  });

  if (!integration) {
    return {
      disconnected: true,
    };
  }

  if (!getDevModeState().enabled) {
    await deleteReminderEvents(integration).catch(() => null);
  }

  await prisma.userIntegration.delete({
    where: {
      id: integration.id,
    },
  });

  return {
    disconnected: true,
  };
}

export function isGoogleCalendarConnected(
  integration: { provider: string } | null,
) {
  return integration?.provider === GOOGLE_PROVIDER;
}
