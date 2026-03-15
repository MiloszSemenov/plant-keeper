const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function parseDayOffset(value?: string | null) {
  const parsedOffset = Number(value ?? "0");

  if (!Number.isFinite(parsedOffset)) {
    return 0;
  }

  return Math.trunc(parsedOffset);
}

export function getCurrentDate(dayOffset = 0) {
  return new Date(Date.now() + dayOffset * DAY_IN_MS);
}

export function getDevModeState(searchParams?: { devMode?: string; dayOffset?: string }) {
  const enabled =
    process.env.NODE_ENV !== "production" &&
    (process.env.PLANT_KEEPER_DEV_MODE === "true" || searchParams?.devMode === "true");
  const dayOffset = enabled ? parseDayOffset(searchParams?.dayOffset) : 0;

  return {
    enabled,
    dayOffset,
    now: getCurrentDate(dayOffset)
  };
}
