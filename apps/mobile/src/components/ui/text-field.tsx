import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";

import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";

/**
 * Labeled input matching the web auth fields: 16px corners, warm border,
 * clay focus ring. Extra TextInput props pass straight through.
 */
export function TextField({
  label,
  ...inputProps
}: { label: string } & TextInputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: space.sm }}>
      <Text
        style={{
          fontFamily: fontFamilies.bodyMedium,
          fontSize: fontSize.base,
          color: colors.textStrong,
        }}
      >
        {label}
      </Text>
      <TextInput
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          inputProps.onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          inputProps.onBlur?.(event);
        }}
        placeholderTextColor={colors.textSubtle}
        style={[
          {
            borderWidth: focused ? 2 : 1,
            borderColor: focused ? colors.focusRing : colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.card,
            paddingHorizontal: space.md,
            paddingVertical: 12,
            fontFamily: fontFamilies.body,
            fontSize: fontSize.base,
            color: colors.textStrong,
          },
          inputProps.style,
        ]}
      />
    </View>
  );
}
