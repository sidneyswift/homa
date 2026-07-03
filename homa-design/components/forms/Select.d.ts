import * as React from 'react';

export interface SelectOption { value: string; label: string; }

export interface SelectProps {
  label?: string;
  hint?: string;
  options: (string | SelectOption)[];
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  style?: React.CSSProperties;
}

/** Styled native select with chevron. */
export function Select(props: SelectProps): JSX.Element;
