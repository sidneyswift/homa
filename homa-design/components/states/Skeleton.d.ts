import * as React from 'react';

export interface SkeletonProps {
  /** @default "100%" */
  width?: number | string;
  /** @default 16 */
  height?: number | string;
  /** @default "var(--radius-sm)" */
  radius?: string;
  style?: React.CSSProperties;
}

/** Warm shimmer placeholder while content loads. */
export function Skeleton(props: SkeletonProps): JSX.Element;
