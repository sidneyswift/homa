import * as React from 'react';

/**
 * Props for the Homa card surface.
 */
export interface CardProps {
  /** @default "md" */
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Lift + deepen shadow on hover. @default false */
  interactive?: boolean;
  /** Start at md shadow rather than sm. @default false */
  elevated?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * Soft warm surface container, the base of every Homa layout.
 */
export function Card(props: CardProps): JSX.Element;
