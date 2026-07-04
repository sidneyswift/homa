import * as React from 'react';

export interface SquiggleProps {
  /** Stroke color. @default "var(--text-strong)" */
  color?: string;
  /** Number of wave bumps before the rule. @default 5 */
  segments?: number;
  /** Continue into a thin rule filling the row. @default true */
  line?: boolean;
  style?: React.CSSProperties;
}

/** Playful heading divider: a hand-drawn wave settling into a thin rule. */
export function Squiggle(props: SquiggleProps): JSX.Element;
