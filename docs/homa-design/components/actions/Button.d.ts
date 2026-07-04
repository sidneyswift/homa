import * as React from 'react';

export interface ButtonProps {
  /** Visual style. @default "primary" */
  variant?: 'primary' | 'secondary' | 'soft' | 'ghost' | 'danger';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Primary interactive control for HOMA. Pill-shaped, warm clay primary.
 * @startingPoint section="Actions" subtitle="Pill buttons in every variant" viewport="700x180"
 */
export function Button(props: ButtonProps): JSX.Element;
