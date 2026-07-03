import * as React from 'react';

export interface CheckboxProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
}

/** Rounded checkbox with clay fill + white check when selected. */
export function Checkbox(props: CheckboxProps): JSX.Element;
