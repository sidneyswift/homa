import type { HTMLAttributes, ReactNode } from "react";

type PageHeaderProps = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  heading: ReactNode;
  headingId?: string;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

/**
 * Orientation for a signed-in route. The header owns hierarchy and the
 * optional action group, while the route keeps its domain controls and copy.
 */
export function PageHeader({
  heading,
  headingId,
  eyebrow,
  description,
  actions,
  compact = false,
  className = "",
  ...props
}: PageHeaderProps) {
  return (
    <header
      {...props}
      className={`quiet-page-header${compact ? " quiet-page-header--compact" : ""} ${className}`.trim()}
      data-page-header=""
    >
      <div className="quiet-page-header__copy">
        {eyebrow ? <p className="quiet-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 id={headingId} className="quiet-page-header__heading">
          {heading}
        </h1>
        {description ? <p className="quiet-page-header__description">{description}</p> : null}
      </div>
      {actions ? (
        <div className="quiet-page-header__actions" role="group" aria-label="Page actions">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
