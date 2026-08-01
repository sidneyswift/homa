import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export interface VoiceAudioRouteSnapshot {
  category: string;
  mode: string;
  outputVolume: number;
  outputs: string[];
}

interface NativeHomaVoiceAudioModule {
  prepareForConversation(): Promise<VoiceAudioRouteSnapshot>;
  currentRoute(): Promise<VoiceAudioRouteSnapshot>;
}

const nativeModule =
  requireOptionalNativeModule<NativeHomaVoiceAudioModule>("HomaVoiceAudio");

/** Configure WebRTC's native iOS audio session before microphone capture. */
export async function prepareVoiceAudioForConversation(): Promise<VoiceAudioRouteSnapshot | null> {
  if (Platform.OS !== "ios") return null;
  if (!nativeModule) {
    throw new Error("I could not prepare the speaker just now.");
  }
  return nativeModule.prepareForConversation();
}

/** Sanitized route state for device verification. Contains no conversation data. */
export async function currentVoiceAudioRoute(): Promise<VoiceAudioRouteSnapshot | null> {
  if (Platform.OS !== "ios" || !nativeModule) return null;
  return nativeModule.currentRoute();
}
