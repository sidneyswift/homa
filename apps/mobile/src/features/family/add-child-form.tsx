import { useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { TextField } from "../../components/ui/text-field";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { addChild } from "../../lib/family";
import { colors, fontFamilies, fontSize, space } from "../../theme/app2";

/** Add-a-child intake, mirroring apps/web/app/app/settings/add-child-form.tsx. */
export function AddChildForm({
  familyId,
  onAdded,
}: {
  familyId: string;
  onAdded: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [interests, setInterests] = useState("");
  const [focus, setFocus] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  useAccessibilityAnnouncement(receipt);

  async function submit() {
    setPending(true);
    setError(null);
    setReceipt(null);
    const result = await addChild({
      familyId,
      name,
      birthYear: Number(birthYear),
      birthMonth: Number(birthMonth),
      birthDay: Number(birthDay),
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
    const addedName = name.trim();
    setName("");
    setBirthYear("");
    setBirthMonth("");
    setBirthDay("");
    setInterests("");
    setFocus("");
    setReceipt(`${addedName} added.`);
    onAdded();
  }

  return (
    <Card style={{ gap: space.md }}>
      <Text
        accessibilityRole="header"
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
      <View style={{ flexDirection: fontScale >= 1.4 ? "column" : "row", gap: space.md }}>
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
        <View style={{ flex: 1 }}>
          <TextField
            label="Birth day"
            value={birthDay}
            onChangeText={setBirthDay}
            placeholder="12"
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
      {error ? <InlineError message={error} /> : null}
      {receipt ? (
        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
          {receipt}
        </Text>
      ) : null}
      <Button
        label={pending ? "One moment\u2026" : "Add child"}
        onPress={() => void submit()}
        busy={pending}
      />
    </Card>
  );
}
