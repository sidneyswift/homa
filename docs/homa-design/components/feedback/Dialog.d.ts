import * as React from 'react';

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  /** @default 480 */
  width?: number;
  style?: React.CSSProperties;
}

/** Centered modal over a warm blurred scrim. */
export function Dialog(props: DialogProps): JSX.Element;
