import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type CardTone = "default" | "soft" | "danger" | "muted";
export type CardPadding = "none" | "sm" | "md" | "lg";

export function cardClassName({
  tone = "default",
  padding = "md",
  className
}: {
  tone?: CardTone;
  padding?: CardPadding;
  className?: string;
}) {
  return cn("ui-card", `ui-card--${tone}`, `ui-card--${padding}`, className);
}

type CardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: CardTone;
  padding?: CardPadding;
};

export function Card({
  children,
  tone = "default",
  padding = "md",
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cardClassName({
        className,
        padding,
        tone
      })}
      {...props}
    >
      {children}
    </div>
  );
}
