import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { TextField } from "../../components/ui/text-field";
import { addChild } from "../../lib/family";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

/** Add-a-child intake, mirroring apps/web/app/home/setup-forms.tsx. */
export function AddChildForm({
  familyId,
  onAdded,
}: {
  familyId: string;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [interests, setInterests] = useState("");
  const [focus, setFocus] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const result = await addChild({
      familyId,
      name,
      birthYear: Number(birthYear),
      birthMonth: Number(birthMonth),
      interests: interests
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      focus: focus.trim(),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setName("");
    setBirthYear("");
    setBirthMonth("");
    setInterests("");
    setFocus("");
    onAdded();
  }

  return (
    <Card style={{ gap: space.md }}>
      <Text
        style={{
          fontFamily: fontFamilies.displaySemibold,
          fontSize: fontSize.lg,
          color: colors.textStrong,
        }}
      >
        Add a child
      </Text>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Maya"
        autoCapitalize="words"
      />
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Birth year"
            value={birthYear}
            onChangeText={setBirthYear}
            placeholder="2019"
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Birth month"
            value={birthMonth}
            onChangeText={setBirthMonth}
            placeholder="4"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      <TextField
        label="Into (optional, comma-separated)"
        value={interests}
        onChangeText={setInterests}
        placeholder="dinosaurs, drawing"
      />
      <TextField
        label="Working on (optional)"
        value={focus}
        onChangeText={setFocus}
        placeholder="reading confidence"
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
        label={pending ? "One moment\u2026" : "Add child"}
        onPress={() => void submit()}
        disabled={pending}
      />
    </Card>
  );
}
