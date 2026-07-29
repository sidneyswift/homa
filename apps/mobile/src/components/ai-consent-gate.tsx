import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import {
  getMyConsentStatus,
  recordAiProcessingConsent,
} from "../lib/family";
import { openPrivacyPolicy } from "../lib/web-links";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

/**
 * App Review 5.1.2(i): explicit, affirmative consent before family data
 * reaches Homa, the moment it becomes true, chat, not sign-in (a family
 * mid web onboarding has nothing going to Homa yet either). Wraps
 * ChatSession; renders the disclosure in its place until the signed-in
 * adult agrees, then passes through. Record lives on family_members
 * (supabase/migrations/20260728190000_ai_processing_consent.sql), not a
 * local flag, so it survives reinstalls and is auditable.
 */
export function AiConsentGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<"loading" | "needed" | "given">(
    "loading",
  );
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMyConsentStatus().then((consented) => {
      if (!cancelled) setStatus(consented ? "given" : "needed");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAgree() {
    setSaving(true);
    setErrorMessage(null);
    try {
      await recordAiProcessingConsent();
      setStatus("given");
    } catch {
      setErrorMessage("That didn't go through. You can try again when you're ready.");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading") {
    return <ActivityIndicator color={colors.brand} style={{ marginTop: space.xl }} />;
  }

  if (status === "given") {
    return <>{children}</>;
  }

  return (
    <View style={{ padding: space.lg }}>
      <Card style={{ gap: space.md }}>
        <Text
          style={{
            fontFamily: fontFamilies.displaySemibold,
            fontSize: fontSize.lg,
            color: colors.textStrong,
          }}
        >
          Before you chat with Homa
        </Text>
        <Text
          style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody }}
        >
          {
            "What you and your kids share here, including what you write and your family's details, is processed by outside AI providers so Homa can help. We never sell it."
          }
        </Text>
        <Button
          label="Read the privacy policy"
          variant="ghost"
          onPress={() => void openPrivacyPolicy()}
        />
        {errorMessage ? (
          <Text
            style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.danger }}
          >
            {errorMessage}
          </Text>
        ) : null}
        <Button
          label={saving ? "One moment\u2026" : "I agree, let's chat"}
          onPress={() => void handleAgree()}
          disabled={saving}
        />
      </Card>
    </View>
  );
}
