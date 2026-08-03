import Link from "next/link";
import type { ButtonHTMLAttributes, MouseEventHandler, ReactNode } from "react";

type ActionProps = {
  children: ReactNode;
  kind?: "primary" | "secondary" | "quiet";
  size?: "default" | "large";
  href?: string;
  className?: string;
  icon?: ReactNode;
  onClick?: MouseEventHandler<HTMLElement>;
} & Pick<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "disabled"
  | "type"
  | "form"
  | "aria-haspopup"
  | "aria-expanded"
  | "aria-label"
>;

export function QuietAction({
  children,
  kind = "primary",
  size = "default",
  href,
  className = "",
  icon,
  disabled = false,
  type = "button",
  form,
  onClick,
  "aria-haspopup": ariaHasPopup,
  "aria-expanded": ariaExpanded,
  "aria-label": ariaLabel,
}: ActionProps) {
  const classes = `quiet-action quiet-action--${kind} quiet-action--${size} ${className}`.trim();
  const content = (
    <>
      <span>{children}</span>
      {icon ? <span className="quiet-action__icon" aria-hidden="true">{icon}</span> : null}
    </>
  );

  if (href && !disabled) {
    return (
      <Link className={classes} href={href} onClick={onClick} aria-haspopup={ariaHasPopup} aria-expanded={ariaExpanded} aria-label={ariaLabel}>
        {content}
      </Link>
    );
  }
  return <button className={classes} disabled={disabled} type={type} form={form} onClick={onClick} aria-haspopup={ariaHasPopup} aria-expanded={ariaExpanded} aria-label={ariaLabel}>{content}</button>;
}
