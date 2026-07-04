import * as React from 'react';

export interface BadgeProps {
  /** @default "neutral" */
  tone?: 'neutral' | 'brand' | 'sage' | 'gold' | 'success' | 'warning' | 'danger' | 'info';
  /** @default "soft" */
  variant?: 'soft' | 'solid';
  iconLeft?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Small status/label pill. */
export function Badge(props: BadgeProps): JSX.Element;
