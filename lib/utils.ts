import { differenceInCalendarDays } from "@/lib/time";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function getInitials(value?: string | null) {
  if (!value) {
    return "?";
  }

  const parts = value.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function getPlantStatusLabel(nextWateringAt: Date | string, now = new Date()) {
  const nextDate = typeof nextWateringAt === "string" ? new Date(nextWateringAt) : nextWateringAt;
  const delta = differenceInCalendarDays(nextDate, now);

  if (delta < 0) {
    return {
      tone: "danger",
      text: `Overdue by ${Math.abs(delta)} day${Math.abs(delta) === 1 ? "" : "s"}`
    };
  }

  if (delta === 0) {
    return {
      tone: "warning",
      text: "Water today"
    };
  }

  if (delta === 1) {
    return {
      tone: "info",
      text: "Water tomorrow"
    };
  }

  return {
    tone: "success",
    text: `Water in ${delta} days`
  };
}
