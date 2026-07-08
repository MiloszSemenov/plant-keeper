import { prisma } from "@/db/client";
import { ApiError } from "@/lib/http";
import {
  FREE_MONTHLY_PHOTO_IDENTIFICATIONS,
  getGlobalDailyPhotoIdentificationLimit
} from "@/lib/plan-limits";

function currentMonthPeriod(now: Date) {
  return {
    periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
    periodEnd: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  };
}

function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getPhotoIdentificationUsage(userId: string) {
  const { periodStart, periodEnd } = currentMonthPeriod(new Date());
  const usage = await prisma.userUsage.findUnique({
    where: {
      userId_periodStart: { userId, periodStart }
    }
  });

  return {
    used: usage?.photoIdentificationsUsed ?? 0,
    limit: FREE_MONTHLY_PHOTO_IDENTIFICATIONS,
    periodEnd
  };
}

export async function assertPhotoIdentificationQuota(userId: string) {
  const now = new Date();
  const { periodStart, periodEnd } = currentMonthPeriod(now);
  const today = startOfUtcDay(now);

  const [daily, userUsage] = await Promise.all([
    prisma.dailyUsage.findUnique({ where: { date: today } }),
    prisma.userUsage.findUnique({
      where: {
        userId_periodStart: { userId, periodStart }
      }
    })
  ]);

  if ((daily?.photoIdentificationsUsed ?? 0) >= getGlobalDailyPhotoIdentificationLimit()) {
    throw new ApiError(
      429,
      "Photo identification is temporarily unavailable. Try searching by name instead, or come back tomorrow."
    );
  }

  if ((userUsage?.photoIdentificationsUsed ?? 0) >= FREE_MONTHLY_PHOTO_IDENTIFICATIONS) {
    const resetLabel = periodEnd.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      timeZone: "UTC"
    });

    throw new ApiError(
      429,
      `You've used all ${FREE_MONTHLY_PHOTO_IDENTIFICATIONS} photo identifications for this month. Your limit resets on ${resetLabel}.`
    );
  }
}

export async function recordPhotoIdentification(userId: string) {
  const now = new Date();
  const { periodStart, periodEnd } = currentMonthPeriod(now);
  const today = startOfUtcDay(now);

  await prisma.$transaction([
    prisma.dailyUsage.upsert({
      where: { date: today },
      create: { date: today, photoIdentificationsUsed: 1 },
      update: { photoIdentificationsUsed: { increment: 1 } }
    }),
    prisma.userUsage.upsert({
      where: {
        userId_periodStart: { userId, periodStart }
      },
      create: { userId, periodStart, periodEnd, photoIdentificationsUsed: 1 },
      update: { photoIdentificationsUsed: { increment: 1 } }
    })
  ]);
}
