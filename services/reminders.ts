import { prisma } from "@/db/client";
import { endOfUtcDay, startOfUtcDay } from "@/lib/time";
import { sendWateringReminderEmail } from "@/services/email";
import { syncGoogleCalendarReminders } from "@/services/google-calendar";

type ReminderPlant = {
  id: string;
  nickname: string;
  speciesName: string;
  nextWateringAt: Date;
  vaultName: string;
};

function getNotificationKey(userId: string, scopeId: string) {
  return `${userId}:${scopeId}`;
}

function isEmailReminderEnabled({
  userId,
  plantId,
  vaultId,
  plantNotificationMap,
  vaultNotificationMap
}: {
  userId: string;
  plantId: string;
  vaultId: string;
  plantNotificationMap: Map<string, boolean>;
  vaultNotificationMap: Map<string, boolean>;
}) {
  const plantSetting = plantNotificationMap.get(getNotificationKey(userId, plantId));

  if (plantSetting !== undefined) {
    return plantSetting;
  }

  const vaultSetting = vaultNotificationMap.get(getNotificationKey(userId, vaultId));
  return vaultSetting === true;
}

export async function sendDailyWateringReminders(options?: {
  now?: Date;
  debug?: boolean;
  forceCalendar?: boolean;
  includeOverdue?: boolean;
}) {
  const now = options?.now ?? new Date();
  const reminderDate = startOfUtcDay(now);
  const dueBefore = endOfUtcDay(now);
  const includeOverdue = options?.includeOverdue ?? true;

  const duePlants = await prisma.plant.findMany({
    where: {
      nextWateringAt: includeOverdue
        ? {
            lte: dueBefore
          }
        : {
            gte: reminderDate,
            lte: dueBefore
          }
    },
    include: {
      species: true,
      vault: {
        include: {
          memberships: {
            include: {
              user: true
            }
          }
        }
      }
    },
    orderBy: {
      nextWateringAt: "asc"
    }
  });

  if (options?.debug) {
    console.info("[reminders] eligible plants", {
      eligiblePlants: duePlants.length,
      reminderDate: reminderDate.toISOString(),
      dueBefore: dueBefore.toISOString(),
      includeOverdue
    });
  }

  const userIds = Array.from(
    new Set(
      duePlants.flatMap((plant) => plant.vault.memberships.map((membership) => membership.userId))
    )
  );
  const plantIds = duePlants.map((plant) => plant.id);
  const vaultIds = Array.from(new Set(duePlants.map((plant) => plant.vaultId)));

  const notificationSettings =
    userIds.length === 0
      ? []
      : await prisma.notificationSetting.findMany({
          where: {
            userId: {
              in: userIds
            },
            OR: [
              {
                plantId: {
                  in: plantIds
                }
              },
              {
                vaultId: {
                  in: vaultIds
                }
              }
            ]
          }
        });

  const plantNotificationMap = new Map<string, boolean>();
  const vaultNotificationMap = new Map<string, boolean>();

  for (const setting of notificationSettings) {
    if (setting.plantId) {
      plantNotificationMap.set(
        getNotificationKey(setting.userId, setting.plantId),
        setting.emailEnabled
      );
    }

    if (setting.vaultId) {
      vaultNotificationMap.set(
        getNotificationKey(setting.userId, setting.vaultId),
        setting.emailEnabled
      );
    }
  }

  const perUser = new Map<
    string,
    {
      email: string;
      name?: string | null;
      plants: ReminderPlant[];
    }
  >();
  let notificationsDisabledSkips = 0;

  for (const plant of duePlants) {
    for (const membership of plant.vault.memberships) {
      const emailEnabled = isEmailReminderEnabled({
        userId: membership.userId,
        plantId: plant.id,
        vaultId: plant.vaultId,
        plantNotificationMap,
        vaultNotificationMap
      });

      if (!emailEnabled) {
        notificationsDisabledSkips += 1;
        continue;
      }

      const existing = perUser.get(membership.userId) ?? {
        email: membership.user.email,
        name: membership.user.name,
        plants: []
      };

      if (!existing.plants.some((item) => item.id === plant.id)) {
        existing.plants.push({
          id: plant.id,
          nickname: plant.nickname,
          speciesName: plant.species.scientificName,
          nextWateringAt: plant.nextWateringAt,
          vaultName: plant.vault.name
        });
      }

      perUser.set(membership.userId, existing);
    }
  }

  if (options?.debug) {
    console.info("[reminders] recipients prepared", {
      recipients: perUser.size,
      notificationsDisabledSkips
    });
  }

  const calendarSummary = await syncGoogleCalendarReminders({
    reminderUserIds: Array.from(perUser.entries())
      .filter(([, recipient]) => recipient.plants.length > 0)
      .map(([userId]) => userId),
    date: reminderDate,
    forceLog: options?.forceCalendar
  }).catch((error) => {
    console.error("[reminders] calendar_sync_failed", {
      error: error instanceof Error ? error.message : "unknown_error"
    });

    return null;
  });

  const existingEmails = await prisma.reminderEmail.findMany({
    where: {
      reminderDate,
      userId: {
        in: Array.from(perUser.keys())
      }
    }
  });

  const alreadySentIds = new Set(existingEmails.map((item) => item.userId));
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let alreadySentSkips = 0;
  let emptyRecipientSkips = 0;

  for (const [userId, recipient] of perUser) {
    if (alreadySentIds.has(userId)) {
      alreadySentSkips += 1;
      skipped += 1;

      if (options?.debug) {
        console.info("[reminders] skipping recipient", {
          userId,
          reason: "already_sent"
        });
      }

      continue;
    }

    if (recipient.plants.length === 0) {
      emptyRecipientSkips += 1;
      skipped += 1;

      if (options?.debug) {
        console.info("[reminders] skipping recipient", {
          userId,
          reason: "no_plants_after_filtering"
        });
      }

      continue;
    }

    const delivery = await sendWateringReminderEmail({
      to: recipient.email,
      recipientName: recipient.name,
      plants: recipient.plants
    });

    if (!delivery.delivered) {
      failed += 1;

      if (options?.debug) {
        console.info("[reminders] delivery failed", {
          userId,
          reason: "email_delivery_failed"
        });
      }

      continue;
    }

    await prisma.reminderEmail.create({
      data: {
        userId,
        reminderDate,
        plantIds: recipient.plants.map((plant) => plant.id)
      }
    });

    sent += 1;
  }

  if (options?.debug) {
    console.info("[reminders] summary", {
      eligiblePlants: duePlants.length,
      recipients: perUser.size,
      sent,
      skipped,
      failed,
      skipReasons: {
        notificationsDisabled: notificationsDisabledSkips,
        alreadySent: alreadySentSkips,
        emptyRecipients: emptyRecipientSkips
      }
    });
  }

  return {
    duePlants: duePlants.length,
    recipients: perUser.size,
    sent,
    skipped,
    failed,
    ...(calendarSummary ? { calendar: calendarSummary } : {}),
    ...(options?.debug
      ? {
          debug: {
            notificationsDisabledSkips,
            alreadySentSkips,
            emptyRecipientSkips
          }
        }
      : {})
  };
}
