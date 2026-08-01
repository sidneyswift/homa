import { AiConsentGate } from "../../components/ai-consent-gate";
import { VoiceScreen } from "../../features/voice/voice-screen";

/**
 * Voice lives inside the shared signed-in shell. The shell owns auth and
 * billing, while the root workbench provider owns the conversation lifetime.
 */
export default function VoiceRoute() {
  return (
    <AiConsentGate>
      <VoiceScreen />
    </AiConsentGate>
  );
}
