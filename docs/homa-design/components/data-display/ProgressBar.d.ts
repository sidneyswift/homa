import * as React from 'react';

export interface ProgressBarProps {
  value?: number;
  max?: number;
  /** @default "brand" */
  tone?: 'brand' | 'sage' | 'gold' | 'info';
  label?: string;
  showValue?: boolean;
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  style?: React.CSSProperties;
}

/** Rounded progress track with clay/sage fill; used across progress dashboards. */
export function ProgressBar(props: ProgressBarProps): JSX.Element;
