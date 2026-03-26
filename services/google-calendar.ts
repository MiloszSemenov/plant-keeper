import { prisma } from "@/db/client";
import { getAppUrl, requireEnv } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { endOfUtcDay, startOfUtcDay } from "@/lib/time";

const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const DEFAULT_REMINDER_HOUR_UTC = 9;
const DEFAULT_EVENT_DURATION_MINUTES = 30;

function hasCalendarScope(scope: string | null) {
  return Boolean(scope?.split(" ").includes(GOOGLE_CALENDAR_SCOPE));
}

function removeCalendarScope(scope: string | null) {
  if (!scope) {
    return null;
  }

  const nextScope = scope
    .split(" ")
    .map((item) => item.trim())
    .filter((item) => item && item !== GOOGLE_CALENDAR_SCOPE)
    .join(" ");

  return nextScope || null;
}

function getDailyEventDateTime(date: Date) {
  const day = startOfUtcDay(date);

  return {
    start: new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        DEFAULT_REMINDER_HOUR_UTC,
        0,
        0
      )
    ),
    end: new Date(
      Date.UTC(
        day.getUTCFullYear(),
        day.getUTCMonth(),
        day.getUTCDate(),
        DEFAULT_REMINDER_HOUR_UTC,
        DEFAULT_EVENT_DURATION_MINUTES,
        0
      )
    )
  };
}

function buildDashboardUrl(vaultId: string) {
  return `${getAppUrl()}/dashboard?vaultId=${vaultId}`;
}

function buildDailyEventPayload(date: Date, vaultId: string) {
  const { start, end } = getDailyEventDateTime(date);

  return {
    summary: "Water your plants",
    description: `Plant Keeper reminder\n${buildDashboardUrl(vaultId)}`,
    start: {
      dateTime: start.toISOString(),
      timeZone: "UTC"
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: "UTC"
    }
  };
}

export async function getGoogleAccount(userId: string) {
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      provider: "google"
    },
    orderBy: {
      id: "asc"
    }
  });

  return accounts.find((account) => hasCalendarScope(account.scope)) ?? accounts[0] ?? null;
}

export async function getGoogleCalendarAccount(userId: string) {
  const accounts = await prisma.account.findMany({
    where: {
      userId,
      provider: "google"
    },
    orderBy: {
      id: "asc"
    }
  });

  return accounts.find((account) => hasCalendarScope(account.scope)) ?? null;
}

async function refreshGoogleAccessToken(account: {
  id: string;
  refresh_token: string | null;
}) {
  const refreshToken = account.refresh_token;

  if (!refreshToken) {
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
      refresh_token: refreshToken
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Google token refresh failed: ${text || response.statusText}`);
  }

  const payload = await response.json();
  const expiresAt =
    typeof payload.expires_in === "number"
      ? Math.floor(Date.now() / 1000) + payload.expires_in
      : null;

  return prisma.account.update({
    where: {
      id: account.id
    },
    data: {
      access_token: typeof payload.access_token === "string" ? payload.access_token : undefined,
      expires_at: expiresAt ?? undefined,
      token_type: typeof payload.token_type === "string" ? payload.token_type : undefined,
      scope: typeof payload.scope === "string" ? payload.scope : undefined,
      refresh_token:
        typeof payload.refresh_token === "string" ? payload.refresh_token : undefined
    }
  });
}

async function getGoogleAccessToken(userId: string) {
  const account = await getGoogleCalendarAccount(userId);

  if (!account) {
    throw new ApiError(400, "Google Calendar is not connected.");
  }

  const expiresAt = account.expires_at ?? 0;
  const isExpired = !account.access_token || expiresAt <= Math.floor(Date.now() / 1000) + 60;

  if (!isExpired) {
    return account.access_token;
  }

  const refreshedAccount = await refreshGoogleAccessToken(account);

  if (!refreshedAccount.access_token) {
    throw new ApiError(400, "Google Calendar is not connected.");
  }

  return refreshedAccount.access_token;
}

async function googleCalendarRequest(
  userId: string,
  path: string,
  options?: RequestInit
) {
  const accessToken = await getGoogleAccessToken(userId);
  const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options?.headers ?? {})
    }
  });

  return response;
}

export async function createOrUpdateDailyEvent(userId: string, date: Date, vaultId: string) {
  const normalizedDate = startOfUtcDay(date);
  const existingEvent = await prisma.calendarDailyEvent.findUnique({
    where: {
      userId_date: {
        userId,
        date: normalizedDate
      }
    }
  });
  const payload = buildDailyEventPayload(normalizedDate, vaultId);

  if (!existingEvent) {
    const response = await googleCalendarRequest(userId, "/calendars/primary/events", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApiError(502, `Google Calendar event creation failed: ${text || response.statusText}`);
    }

    const createdEvent = await response.json();
    const googleEventId =
      typeof createdEvent.id === "string" ? createdEvent.id : null;

    if (!googleEventId) {
      throw new ApiError(502, "Google Calendar event creation returned an invalid event id");
    }

    const calendarEvent = await prisma.calendarDailyEvent.create({
      data: {
        userId,
        date: normalizedDate,
        googleEventId
      }
    });

    return {
      created: true,
      event: calendarEvent
    };
  }

  const response = await googleCalendarRequest(
    userId,
    `/calendars/primary/events/${encodeURIComponent(existingEvent.googleEventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    }
  );

  if (response.status === 404) {
    await prisma.calendarDailyEvent.delete({
      where: {
        id: existingEvent.id
      }
    });

    return createOrUpdateDailyEvent(userId, normalizedDate, vaultId);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new ApiError(502, `Google Calendar event update failed: ${text || response.statusText}`);
  }

  const calendarEvent = await prisma.calendarDailyEvent.update({
    where: {
      id: existingEvent.id
    },
    data: {
      updatedAt: new Date()
    }
  });

  return {
    created: false,
    event: calendarEvent
  };
}

export async function deleteDailyEvent(userId: string, date: Date) {
  const normalizedDate = startOfUtcDay(date);
  const existingEvent = await prisma.calendarDailyEvent.findUnique({
    where: {
      userId_date: {
        userId,
        date: normalizedDate
      }
    }
  });

  if (!existingEvent) {
    return {
      deleted: false
    };
  }

  const response = await googleCalendarRequest(
    userId,
    `/calendars/primary/events/${encodeURIComponent(existingEvent.googleEventId)}`,
    {
      method: "DELETE"
    }
  ).catch(() => null);

  if (response && !response.ok && response.status !== 404) {
    const text = await response.text();
    throw new ApiError(502, `Google Calendar event deletion failed: ${text || response.statusText}`);
  }

  await prisma.calendarDailyEvent.delete({
    where: {
      id: existingEvent.id
    }
  });

  return {
    deleted: true
  };
}

async function findCalendarEligibleVaultId(userId: string, date: Date) {
  const duePlants = await prisma.plant.findMany({
    where: {
      nextWateringAt: {
        lte: endOfUtcDay(date)
      },
      vault: {
        memberships: {
          some: {
            userId
          }
        }
      }
    },
    include: {
      notificationSettings: {
        where: {
          userId
        },
        take: 1
      },
      vault: {
        include: {
          notificationSettings: {
            where: {
              userId
            },
            take: 1
          }
        }
      }
    },
    orderBy: {
      nextWateringAt: "asc"
    }
  });

  const eligiblePlant = duePlants.find(
    (plant) =>
      plant.notificationSettings[0]?.calendarEnabled ??
      plant.vault.notificationSettings[0]?.calendarEnabled ??
      false
  );

  return eligiblePlant?.vaultId ?? null;
}

export async function syncDailyEventsForUser(userId: string, date = new Date()) {
  const vaultId = await findCalendarEligibleVaultId(userId, date);

  if (!vaultId) {
    return deleteDailyEvent(userId, date);
  }

  return createOrUpdateDailyEvent(userId, date, vaultId);
}

export async function disconnectGoogleCalendar(userId: string) {
  const googleAccounts = await prisma.account.findMany({
    where: {
      userId,
      provider: "google"
    }
  });
  const events = await prisma.calendarDailyEvent.findMany({
    where: {
      userId
    }
  });

  for (const event of events) {
    await deleteDailyEvent(userId, event.date).catch(() => null);
  }

  await prisma.notificationSetting.updateMany({
    where: {
      userId
    },
    data: {
      calendarEnabled: false
    }
  });

  for (const account of googleAccounts) {
    const nextScope = removeCalendarScope(account.scope);

    if (nextScope === account.scope) {
      continue;
    }

    await prisma.account.update({
      where: {
        id: account.id
      },
      data: {
        scope: nextScope
      }
    });
  }

  return {
    disconnected: true
  };
}

export function isGoogleCalendarConnected(scope: string | null) {
  return hasCalendarScope(scope);
}
