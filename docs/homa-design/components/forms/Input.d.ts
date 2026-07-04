import * as React from 'react';

export interface InputProps {
  label?: string;
  hint?: string;
  error?: string;
  iconLeft?: React.ReactNode;
  /** @default "md" */
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: string;
  id?: string;
  style?: React.CSSProperties;
}

/** Text field with label, hint, error, and optional leading icon. */
export function Input(props: InputProps): JSX.Element;
