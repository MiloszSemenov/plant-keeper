import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "danger" | "warning" | "info" | "success" | "accent";

export function badgeClassName({
  tone = "neutral",
  uppercase = false,
  className
}: {
  tone?: BadgeTone;
  uppercase?: boolean;
  className?: string;
}) {
  return cn("ui-badge", `ui-badge--${tone}`, uppercase && "ui-badge--uppercase", className);
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
  uppercase?: boolean;
};

export function Badge({
  children,
  tone = "neutral",
  uppercase = false,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={badgeClassName({
        className,
        tone,
        uppercase
      })}
      {...props}
    >
      {children}
    </span>
  );
}
