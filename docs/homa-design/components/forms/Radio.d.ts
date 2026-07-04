import * as React from 'react';

export interface RadioOption { value: string; label: string; }

export interface RadioProps {
  options: (string | RadioOption)[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

/** Single-select radio group. */
export function Radio(props: RadioProps): JSX.Element;
