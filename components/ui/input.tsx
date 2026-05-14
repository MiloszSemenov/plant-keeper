import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  icon?: IconName;
  rightAction?: ReactNode;
  containerClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { icon, rightAction, className, containerClassName, ...props },
  ref
) {
  return (
    <div
      className={cn(
        "ui-input",
        icon && "ui-input--with-icon",
        rightAction && "ui-input--with-right-action",
        containerClassName
      )}
    >
      {icon ? <Icon className="ui-input__icon" name={icon} /> : null}
      <input className={cn("ui-input__field", className)} ref={ref} {...props} />
      {rightAction}
    </div>
  );
});

Input.displayName = "Input";
