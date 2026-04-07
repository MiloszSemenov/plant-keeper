import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "subtle" | "danger";
export type ButtonSize = "sm" | "md" | "icon" | "text";

export function buttonClassName({
  variant = "primary",
  size = "md",
  iconOnly = false,
  className
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
}) {
  return cn(
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${iconOnly ? "icon" : size}`,
    className
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconOnly?: boolean;
  iconPosition?: "left" | "right";
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconOnly = false,
  iconPosition = "left",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClassName({
        className,
        iconOnly,
        size,
        variant
      })}
      {...props}
    >
      {icon && iconPosition === "left" ? <Icon className="ui-button__icon" name={icon} /> : null}
      {iconOnly ? <span className="sr-only">{children}</span> : children}
      {icon && iconPosition === "right" ? <Icon className="ui-button__icon" name={icon} /> : null}
    </button>
  );
}
