import { useState } from "react";
import {
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextInputProps,
} from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, lineHeightFor, radius, space } from "../../theme/tokens";

/**
 * Labeled input matching the web auth fields: 16px corners, warm border,
 * clay focus ring. Extra TextInput props pass straight through.
 */
export function TextField({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);
  const { fontScale } = useWindowDimensions();
  const textLineHeight = lineHeightFor(fontSize.base, fontScale);

  return (
    <View style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.base,
          lineHeight: textLineHeight,
          color: colors.textStrong,
        }}
      >
        {label}
      </Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        placeholderTextColor={colors.textMuted}
        style={[
          {
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? colors.brandHover : colors.textMuted,
            borderRadius: radius.md,
            backgroundColor: colors.card,
            minHeight: 48,
            paddingHorizontal: space.md,
            paddingVertical: 12,
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            lineHeight: textLineHeight,
            color: colors.textStrong,
          },
          inputProps.style,
        ]}
      />
    </View>
  );
}
