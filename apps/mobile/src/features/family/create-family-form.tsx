import { useState } from "react";
import { Text } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { TextField } from "../../components/ui/text-field";
import { createMyFamily } from "../../lib/family";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/** First-run family setup, mirroring the web onboarding's FamilyStep
 * (apps/web/app/onboarding; the web's setup forms now live there and in
 * app/app/settings/add-child-form.tsx). */
export function CreateFamilyForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [parentName, setParentName] = useState("");
  const [usState, setUsState] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await createMyFamily({
      name,
      usState: usState.trim() ? usState.trim().toUpperCase() : null,
      parentName: parentName.trim() || null,
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onCreated();
  }

  return (
    <Card style={{ gap: space.md }}>
      <TextField
        label="Family name"
        value={name}
        onChangeText={setName}
        placeholder="The Rivera family"
        autoCapitalize="words"
      />
      <TextField
        label="Your first name (optional)"
        value={parentName}
        onChangeText={setParentName}
        placeholder="Alessa"
        autoCapitalize="words"
      />
      <TextField
        label="State (optional)"
        value={usState}
        onChangeText={setUsState}
        placeholder="TX"
        autoCapitalize="characters"
        maxLength={2}
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          style={{
            fontFamily: fontFamilies.body,
            fontSize: fontSize.sm,
            color: colors.danger,
          }}
        >
          {error}
        </Text>
      ) : null}
      <Button
        label={pending ? "One moment\u2026" : "Create family"}
        onPress={() => void submit()}
        disabled={pending}
      />
    </Card>
  );
}
