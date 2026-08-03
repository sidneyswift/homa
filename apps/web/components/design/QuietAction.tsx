import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionProps = {
  children: ReactNode;
  kind?: "primary" | "secondary" | "quiet";
  size?: "default" | "large";
  href?: string;
  className?: string;
  icon?: ReactNode;
} & Pick<ButtonHTMLAttributes<HTMLButtonElement>, "disabled" | "type" | "onClick">;

export function QuietAction({
  children,
  kind = "primary",
  size = "default",
  href,
  className = "",
  icon,
  disabled = false,
  type = "button",
  onClick,
}: ActionProps) {
  const classes = `quiet-action quiet-action--${kind} quiet-action--${size} ${className}`.trim();
  const content = (
    <>
      <span>{children}</span>
      {icon ? <span className="quiet-action__icon" aria-hidden="true">{icon}</span> : null}
    </>
  );

  if (href && !disabled) return <Link className={classes} href={href}>{content}</Link>;
  return <button className={classes} disabled={disabled} type={type} onClick={onClick}>{content}</button>;
}
