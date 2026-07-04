import * as React from 'react';

export interface DoodleProps {
  /** Which doodle. @default "star" */
  name?: 'star' | 'heart' | 'sun' | 'sparkle' | 'squiggle';
  /** Pixel size. @default 24 */
  size?: number;
  /** @default "var(--pop-cobalt)" */
  color?: string;
  /** Rotation in degrees, for the hand-placed sticker feel. */
  rotate?: number;
  style?: React.CSSProperties;
}

/** Small hand-drawn decorative shape (star, heart, sun, sparkle, squiggle). Decoration only. */
export function Doodle(props: DoodleProps): JSX.Element;
