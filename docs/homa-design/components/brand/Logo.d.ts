import * as React from 'react';

export interface LogoProps {
  /** Height of the mark in px (wordmark scales with it). @default 32 */
  size?: number;
  /** "full" = mark + wordmark; "mark" = symbol only (favicon/app icon). @default "full" */
  variant?: 'full' | 'mark';
  /** The background the logo sits on. @default "light" */
  tone?: 'light' | 'dark';
  /** "line" = outlined mark; "duo" = 2-tone (soft-filled home + gold spark). @default "line" */
  treatment?: 'line' | 'duo';
  style?: React.CSSProperties;
}

/**
 * Homa brand lockup, "The bright home" mark + Newsreader wordmark.
 * @startingPoint section="Brand" subtitle="Homa logo lockup & app-icon mark" viewport="700x200"
 */
export function Logo(props: LogoProps): JSX.Element;
