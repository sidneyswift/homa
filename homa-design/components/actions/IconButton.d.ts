import * as React from 'react';

export interface IconButtonProps {
  /** @default "ghost" */
  variant?: 'ghost' | 'soft' | 'outline' | 'primary';
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  /** Pill (round) vs rounded-square. @default true */
  round?: boolean;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Square/round button holding a single Icon. */
export function IconButton(props: IconButtonProps): JSX.Element;
