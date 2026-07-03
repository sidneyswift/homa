import * as React from 'react';

export interface TextareaProps {
  label?: string;
  hint?: string;
  error?: string;
  rows?: number;
  disabled?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  id?: string;
  style?: React.CSSProperties;
}

/** Multi-line text field, styled to match Input. */
export function Textarea(props: TextareaProps): JSX.Element;
