import { cn, getPlantStatusLabel } from "@/lib/utils";

export function StatusPill({
  nextWateringAt,
  now
}: {
  nextWateringAt: Date | string;
  now?: Date;
}) {
  const status = getPlantStatusLabel(nextWateringAt, now);

  return <span className={cn("status-pill", `status-${status.tone}`)}>{status.text}</span>;
}
