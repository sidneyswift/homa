import * as React from 'react';

export interface CalloutProps {
  /** @default "brand" */
  tone?: 'brand' | 'sage' | 'gold' | 'info' | 'warning' | 'danger';
  title?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Inline banner for tips, notes, and HOMA suggestions. */
export function Callout(props: CalloutProps): JSX.Element;
