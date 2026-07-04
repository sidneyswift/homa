import * as React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  body?: React.ReactNode;
  /** Usually a Button. */
  action?: React.ReactNode;
  /** Optional handwritten sign-off (Homa's hand), e.g. "no rush ✎". */
  hand?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Empty state as a warm invitation, icon, serif title, body, action. */
export function EmptyState(props: EmptyStateProps): JSX.Element;
