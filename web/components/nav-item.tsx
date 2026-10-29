import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Icon, { type IconName } from "./icon";
export default function NavItem({
  icon,
  children,
  className = "",
  ...props
}: { icon: IconName; children: ReactNode } & ComponentPropsWithoutRef<"a">) {
  return (
    <a {...props} data-accent={icon} className={`nav-item ${className}`}>
      <span className="nav-icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <span className="nav-label">{children}</span>
      <span className="nav-direction" aria-hidden="true">
        <Icon name="arrow" />
      </span>
    </a>
  );
}
