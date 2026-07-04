import * as React from 'react';

export interface TabItem { value: string; label: string; }

export interface TabsProps {
  tabs: (string | TabItem)[];
  value?: string;
  onChange?: (value: string) => void;
  style?: React.CSSProperties;
}

/** Underline tab bar; clay indicator on the active tab. */
export function Tabs(props: TabsProps): JSX.Element;
