import type { TextInputProps } from "react-native";

import { NativeField } from "./semantic";

/**
 * The Homa text field. A thin pass through to the contract primitive.
 *
 * error and hint are forwarded explicitly because they are not
 * TextInputProps. Without them a caller can only render its own message
 * somewhere else on the screen, which is how the email step ended up
 * showing a field error 200pt above the field it belonged to. The
 * contract requires label-and-error on the field itself
 * (packages/design/src/contract/native.ts, field.accessibility).
 */
export function TextField({
  label,
  error,
  hint,
  ...inputProps
}: { label: string; error?: string; hint?: string } & TextInputProps) {
  return <NativeField {...inputProps} error={error} hint={hint} label={label} />;
}
