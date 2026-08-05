import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
  useFonts as useDMSans,
} from "@expo-google-fonts/dm-sans";
import {
  EBGaramond_400Regular,
  EBGaramond_500Medium,
  EBGaramond_600SemiBold,
  EBGaramond_700Bold,
  useFonts as useEBGaramond,
} from "@expo-google-fonts/eb-garamond";

/**
 * Quiet authority typography: EB Garamond carries human display moments,
 * DM Sans carries interface and body copy. The Homa wordmark is projected
 * from the shared generated image lockup, so native startup only loads fonts
 * that render readable interface text.
 */
export const fontFamilies = {
  display: "EBGaramond_700Bold",
  displaySemibold: "EBGaramond_600SemiBold",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodySemibold: "DMSans_600SemiBold",
  bodyBold: "DMSans_700Bold",
} as const;

export interface HomaFontState {
  loaded: boolean;
  error: Error | null;
}

/** Loads every brand font and surfaces Expo's failure signal to startup. */
export function useHomaFonts(): HomaFontState {
  const [dmSansLoaded, dmSansError] = useDMSans({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });
  const [ebGaramondLoaded, ebGaramondError] = useEBGaramond({
    EBGaramond_400Regular,
    EBGaramond_500Medium,
    EBGaramond_600SemiBold,
    EBGaramond_700Bold,
  });
  return {
    loaded: dmSansLoaded && ebGaramondLoaded,
    error: dmSansError ?? ebGaramondError ?? null,
  };
}
