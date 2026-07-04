import * as React from 'react';

export interface ChipProps {
  children?: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
  onRemove?: () => void;
  iconLeft?: React.ReactNode;
  style?: React.CSSProperties;
}

/** Selectable / removable pill for subjects, filters, tags. */
export function Chip(props: ChipProps): JSX.Element;
