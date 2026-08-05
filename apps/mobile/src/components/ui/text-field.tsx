import type { TextInputProps } from "react-native";

import { NativeField } from "./semantic";

/**
 * Compatibility name for callers that predate the semantic native field.
 * Visual, focus, typography, and accessibility behavior live in NativeField.
 */
export function TextField({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  return <NativeField {...inputProps} label={label} />;
}
