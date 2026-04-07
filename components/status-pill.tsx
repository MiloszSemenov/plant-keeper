import { cn, getPlantStatusLabel } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";

export function StatusPill({
  nextWateringAt,
  now
}: {
  nextWateringAt: Date | string;
  now?: Date;
}) {
  const status = getPlantStatusLabel(nextWateringAt, now);
  const toneByStatus: Record<typeof status.tone, BadgeTone> = {
    danger: "danger",
    info: "info",
    neutral: "neutral",
    success: "success",
    warning: "warning"
  };

  return (
    <Badge className={cn("status-pill", `status-${status.tone}`)} tone={toneByStatus[status.tone]}>
      {status.text}
    </Badge>
  );
}
