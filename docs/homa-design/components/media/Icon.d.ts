import * as React from 'react';

export interface IconProps {
  /** Lucide icon name, e.g. "sparkles", "book-open", "chart-line". */
  name: string;
  /** Pixel size (width & height). @default 20 */
  size?: number;
  /** @default 1.75 */
  strokeWidth?: number;
  color?: string;
  style?: React.CSSProperties;
}

/**
 * Lucide icon wrapper, Homa's canonical icon set. Requires the Lucide CDN
 * script on the page: <script src="https://unpkg.com/lucide@0.525.0"></script>
 * and a lucide.createIcons() call after mount.
 */
export function Icon(props: IconProps): JSX.Element;
