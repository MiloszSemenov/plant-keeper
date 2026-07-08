import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const iconPaths = {
  dashboard: "/icons/dashboard-fill.svg",
  plant: "/icons/sprout-fill.svg",
  add: "/icons/plus-circle-fill.svg",
  home: "/icons/home-fill.svg",
  spaces: "/icons/users.svg",
  members: "/icons/user-list.svg",
  invite: "/icons/plus-circle.svg",
  removeMember: "/icons/user-minus.svg",
  settings: "/icons/gear-fill.svg",
  water: "/icons/droplet-fill.svg",
  edit: "/icons/edit.svg",
  notifications: "/icons/notification.svg",
  notificationsOff: "/icons/notification-off.svg",
  notificationFill: "/icons/notification-fill.svg",
  save: "/icons/save.svg",
  saveFill: "/icons/save-fill.svg",
  save_plant: "/icons/save2-fill.svg",
  trash: "/icons/trash.svg",
  close: "/icons/x.svg",
  back: "/icons/arrow-left.svg",
  search: "/icons/search.svg",
  camera: "/icons/camera.svg",
  cameraFill: "/icons/camera-fill.svg",
  usersFill: "/icons/users-fill.svg",
  listDashesFill: "/icons/list-dashes-fill.svg",
  calendarFill: "/icons/calendar-dots-fill.svg",
  leafFill: "/icons/leaf-fill.svg",
  leaf: "/icons/leaf.svg",
  clockCounterClockwise: "/icons/clock-counter-clockwise.svg",
  calendarPlus: "/icons/calendar-plus.svg",
  dotsThreeVertical: "/icons/dots-three-vertical.svg",
  dotsThree: "/icons/dots-three.svg",
  check: "/icons/check.svg",
  plantFill: "/icons/plant-fill.svg",
  sunFill: "/icons/sun-fill.svg",
  soilIcon: "/icons/soil-icon.svg",
  flaskFill: "/icons/flask-fill.svg",
  pawFill: "/icons/paw-print-fill.svg",
  userPlusFill: "/icons/user-plus-fill.svg",
  calendarDots: "/icons/calendar-dots.svg",
  googleCalendar: "/icons/google_calendar_icon.svg",
  arrowClockwise: "/icons/arrow-clockwise-fill.svg",
  linkSimple: "/icons/link-simple.svg",
  clipboard: "/icons/clipboard.svg"
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
