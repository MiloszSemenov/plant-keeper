import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionProps = {
  eyebrow?: string;
  title: string;
  badge?: ReactNode;
  action?: ReactNode;
  description?: string;
  subdued?: boolean;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function Section({
  eyebrow,
  title,
  badge,
  action,
  description,
  subdued = false,
  className,
  bodyClassName,
  children
}: SectionProps) {
  return (
    <section className={cn("ui-section", subdued && "ui-section--subdued", className)}>
      <div className="ui-section__header">
        <div className="ui-section__copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <div className="ui-section__title-row">
            <h2>{title}</h2>
            {badge}
          </div>
          {description ? <p>{description}</p> : null}
        </div>
        {action ? <div className="ui-section__action">{action}</div> : null}
      </div>
      <div className={cn("ui-section__body", bodyClassName)}>{children}</div>
    </section>
  );
}
