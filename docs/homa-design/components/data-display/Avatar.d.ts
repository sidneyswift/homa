import * as React from 'react';

export interface AvatarProps {
  name?: string;
  src?: string | null;
  /** Pixel diameter. @default 40 */
  size?: number;
  /** Override auto background color. */
  tone?: string;
  style?: React.CSSProperties;
}

/** Circular avatar, photo or auto-colored initials from name. */
export function Avatar(props: AvatarProps): JSX.Element;
