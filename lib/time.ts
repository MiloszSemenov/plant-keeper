const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1, 0, 0, 0, -1);
}

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function endOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, -1)
  );
}

export function differenceInCalendarDays(left: Date, right: Date) {
  const leftDay = startOfLocalDay(left).getTime();
  const rightDay = startOfLocalDay(right).getTime();
  return Math.round((leftDay - rightDay) / DAY_IN_MS);
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(typeof date === "string" ? new Date(date) : date);
}

export function formatDaysAgo(date: Date | string, now = new Date()) {
  const value = typeof date === "string" ? new Date(date) : date;
  const days = Math.max(0, differenceInCalendarDays(now, value));

  if (days === 0) {
    return "today";
  }

  if (days === 1) {
    return "1 day ago";
  }

  return `${days} days ago`;
}

export function formatTimeAgo(date: Date | string, now = new Date()) {
  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Math.max(0, now.getTime() - value.getTime());
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.round(diffMs / minute));
    return `${minutes}m ago`;
  }

  if (diffMs < day) {
    const hours = Math.max(1, Math.round(diffMs / hour));
    return `${hours}h ago`;
  }

  if (diffMs < 7 * day) {
    const days = Math.max(1, Math.round(diffMs / day));
    return `${days}d ago`;
  }

  return formatDate(value);
}
