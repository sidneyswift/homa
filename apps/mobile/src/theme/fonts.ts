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

/** Loads every brand font; the splash screen holds until this settles. */
export function useHomaFonts(): boolean {
  const [schibstedLoaded] = useSchibsted({
    SchibstedGrotesk_600SemiBold,
    SchibstedGrotesk_700Bold,
  });
  const [hankenLoaded] = useHanken({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
  });
  const [fredokaLoaded] = useFredoka({ Fredoka_600SemiBold });
  return schibstedLoaded && hankenLoaded && fredokaLoaded;
}
