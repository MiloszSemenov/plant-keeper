import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const iconPaths = {
  dashboard: "/icons/dashboard.svg",
  plant: "/icons/sprout.svg",
  add: "/icons/plus-circle.svg",
  home: "/icons/home.svg",
  spaces: "/icons/users.svg",
  members: "/icons/user-list.svg",
  invite: "/icons/user-plus.svg",
  removeMember: "/icons/user-minus.svg",
  settings: "/icons/gear.svg",
  water: "/icons/droplet.svg",
  edit: "/icons/edit.svg",
  notifications: "/icons/notification.svg",
  notificationsOff: "/icons/notification-off.svg",
  save: "/icons/save.svg",
  trash: "/icons/trash.svg",
  close: "/icons/x.svg",
  back: "/icons/arrow-left.svg"
} as const;

export type IconName = keyof typeof iconPaths;

type IconProps = HTMLAttributes<HTMLSpanElement> & {
  name: IconName;
  label?: string;
};

export function Icon({ name, className, label, style, ...props }: IconProps) {
  const iconStyle = {
    ...style,
    "--icon-mask": `url(${iconPaths[name]})`
  } as CSSProperties;

  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={cn("ui-icon", className)}
      role={label ? "img" : undefined}
      style={iconStyle}
      {...props}
    />
  );
}
