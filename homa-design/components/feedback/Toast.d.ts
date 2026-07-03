import * as React from 'react';

export interface ToastProps {
  open?: boolean;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  /** Optional action label (e.g. "Undo"). */
  action?: string;
  onAction?: () => void;
  /** @default "dark" */
  tone?: 'dark' | 'light';
  /** Render in-flow instead of fixed bottom-center (for demos). @default false */
  inline?: boolean;
  style?: React.CSSProperties;
}

/** Quiet confirmation pill, fixed bottom-center. */
export function Toast(props: ToastProps): JSX.Element;
