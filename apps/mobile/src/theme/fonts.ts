import {
  Fredoka_600SemiBold,
  useFonts as useFredoka,
} from "@expo-google-fonts/fredoka";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  useFonts as useHanken,
} from "@expo-google-fonts/hanken-grotesk";
import {
  SchibstedGrotesk_600SemiBold,
  SchibstedGrotesk_700Bold,
  useFonts as useSchibsted,
} from "@expo-google-fonts/schibsted-grotesk";

/**
 * The three load-bearing brand voices (docs/homa-design typography):
 * Schibsted Grotesk for display, Hanken Grotesk for body/UI, Fredoka for
 * the bounced wordmark only. EB Garamond, Caveat, and JetBrains Mono join
 * later with the surfaces that need them (serif accents, margin notes,
 * numeric readouts).
 */
export const fontFamilies = {
  display: "SchibstedGrotesk_700Bold",
  displaySemibold: "SchibstedGrotesk_600SemiBold",
  body: "HankenGrotesk_400Regular",
  bodyMedium: "HankenGrotesk_500Medium",
  bodySemibold: "HankenGrotesk_600SemiBold",
  bodyBold: "HankenGrotesk_700Bold",
  wordmark: "Fredoka_600SemiBold",
} as const;

export interface HomaFontState {
  loaded: boolean;
  error: Error | null;
}

/** Loads every brand font and surfaces Expo's failure signal to startup. */
export function useHomaFonts(): HomaFontState {
  const [schibstedLoaded, schibstedError] = useSchibsted({
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
  });
  const [hankenLoaded, hankenError] = useHanken({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  const [fredokaLoaded, fredokaError] = useFredoka({ Fredoka_600SemiBold });
  return {
    loaded: schibstedLoaded && hankenLoaded && fredokaLoaded,
    error: schibstedError ?? hankenError ?? fredokaError ?? null,
  };
}
