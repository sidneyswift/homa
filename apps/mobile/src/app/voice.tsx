import { Redirect } from "expo-router";

import { AiConsentGate } from "../components/ai-consent-gate";
import { BillingGate } from "../components/billing-gate";
import { useSession } from "../features/auth/session-provider";
import { VoiceScreen } from "../features/voice/voice-screen";

/**
 * /voice: the fullscreen voice-first surface, presented as a
 * fullScreenModal over the app shell (registered in ./_layout.tsx; the
 * screen's own close button is the way back). Same gates as chat,
 * because this surface talks to the same eve agent: signed in, family
 * entitled (BillingGate; the shell's gate does not cover root routes,
 * and /voice is deep-linkable), and AI processing consent recorded
 * (App Review 5.1.2(i), AiConsentGate).
 */
export default function VoiceRoute() {
  const { session } = useSession();
  if (!session) return <Redirect href="/signin" />;

  return (
    <BillingGate>
      <AiConsentGate>
        <VoiceScreen />
      </AiConsentGate>
    </BillingGate>
  );
}
