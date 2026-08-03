import { DESIGN_CONTRACT_VERSION } from "./version.ts";

export const targetProfiles = {
  webProduct: { channel: "web", motion: "full-expressive", typography: "EB-Garamond-plus-DM-Sans", imagery: "artifact-first", colorMode: "light-default-adaptive-when-ruled" },
  nativeProduct: { channel: "native", motion: "full-expressive", typography: "EB-Garamond-plus-DM-Sans", imagery: "artifact-first", colorMode: "platform-appearance" },
  marketingRich: { channel: "marketing", motion: "static-rich", typography: "EB-Garamond-plus-DM-Sans", imagery: "artifact-first", colorMode: "light-default" },
  emailConstrained: { channel: "email", motion: "static-rich", typography: "safe-fallbacks", imagery: "image-optional", colorMode: "client-controlled" },
  smsPlainText: { channel: "sms", motion: "none", typography: "plain-text", imagery: "none", colorMode: "none" },
  artifactPrint: { channel: "print", motion: "none", typography: "embedded-or-declared-fallback", imagery: "artifact-first", colorMode: "grayscale-proof" },
  providerConstrained: { channel: "provider", motion: "provider-owned", typography: "provider-safe-fallbacks", imagery: "approved-static", colorMode: "provider-controlled" },
  metadataConstrained: { channel: "metadata", motion: "none", typography: "plain-text", imagery: "tiny-static", colorMode: "none" },
} as const;
export type TargetProfile = keyof typeof targetProfiles;
export const PROFILES_CONTRACT = { version: DESIGN_CONTRACT_VERSION, targetProfiles } as const;
