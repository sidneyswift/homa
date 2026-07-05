import * as React from 'react';

/**
 * Props for the Homa brand lockup.
 */
export interface LogoProps {
  /** Height of the mark in px (wordmark scales with it). @default 32 */
  size?: number;
  /** "full" = mark + wordmark; "mark" = symbol only (favicon/app icon). @default "full" */
  variant?: 'full' | 'mark';
  /** The background the logo sits on. @default "light" */
  tone?: 'light' | 'dark';
  /** "solid" = the character (clay body, bright eyes); "line" = quiet one-color outline. @default "solid" */
  treatment?: 'solid' | 'line';
  style?: React.CSSProperties;
}

/**
 * Homa brand lockup, "the little home" character mark + the bounced Fredoka
 * "Homa" wordmark (capital H, letters nudged off the baseline).
 */
export function Logo(props: LogoProps): JSX.Element;
