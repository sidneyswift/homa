import { useRef, useState } from "react";
import { Text, View, useWindowDimensions } from "react-native";

import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { InlineError } from "../../components/ui/inline-error";
import { TextField } from "../../components/ui/text-field";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { createIdempotencyKey } from "../../lib/idempotency-key";
import { addChild } from "../../lib/family";
import { reportCrash } from "../../lib/crash-reporting";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, space } from "../../theme/tokens";

const RECEIPT_DISPLAY_MS = 700;

function waitForReceipt(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, RECEIPT_DISPLAY_MS);
  });
}

/** Add-a-child intake, mirroring apps/web/app/app/settings/add-child-form.tsx. */
export function AddChildForm({
  familyId,
  onAdded,
  embedded = false,
}: {
  familyId: string;
  onAdded: () => void | Promise<void>;
  embedded?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const [name, setName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [interests, setInterests] = useState("");
  const [focus, setFocus] = useState("");
  const [pending, setPending] = useState(false);
  const [ambiguous, setAmbiguous] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  useAccessibilityAnnouncement(receipt ?? error);

  function updateField(setter: (value: string) => void, value: string) {
    // Keep the request id stable across edits until the server gives us a
    // receipt. A timeout may have committed the original learner; changing
    // the id here could create a duplicate on the next tap.
    setter(value);
  }

  async function submit() {
    requestIdRef.current ??= createIdempotencyKey();
    setPending(true);
    setAmbiguous(false);
    setError(null);
    setReceipt(null);
    try {
      const result = await addChild({
        familyId,
        requestId: requestIdRef.current ?? undefined,
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
      if (result.error) {
        setError(result.error);
        return;
      }
      const addedName = name.trim();
      requestIdRef.current = null;
      setAmbiguous(false);
      setName("");
      setBirthYear("");
      setBirthMonth("");
      setBirthDay("");
      setInterests("");
      setFocus("");
      setReceipt(`${addedName} added.`);
      await waitForReceipt();
      await onAdded();
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-onboarding",
        operation: "add-child",
      });
      setError(
        "Homa could not confirm that learner yet. Keep these details unchanged and try again. Nothing else changed.",
      );
      setAmbiguous(true);
      await Promise.resolve(onAdded()).catch((reconcileCause) => {
        reportCrash(reconcileCause, {
          surface: "native-onboarding",
          operation: "reconcile-child-create",
        });
      });
    } finally {
      setPending(false);
    }
  }

  const content = (
    <View style={{ gap: space.md }}>
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
        onChangeText={(value) => updateField(setName, value)}
        editable={!pending && !ambiguous}
        placeholder="Maya"
        autoCapitalize="words"
      />
      <View style={{ flexDirection: fontScale >= 1.4 ? "column" : "row", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="Birth year"
            value={birthYear}
            onChangeText={(value) => updateField(setBirthYear, value)}
            editable={!pending && !ambiguous}
            placeholder="2019"
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Birth month"
            value={birthMonth}
            onChangeText={(value) => updateField(setBirthMonth, value)}
            editable={!pending && !ambiguous}
            placeholder="4"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label="Birth day"
            value={birthDay}
            onChangeText={(value) => updateField(setBirthDay, value)}
            editable={!pending && !ambiguous}
            placeholder="12"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      <TextField
        label="Into (optional, comma-separated)"
        value={interests}
        onChangeText={(value) => updateField(setInterests, value)}
        editable={!pending && !ambiguous}
        placeholder="dinosaurs, drawing"
      />
      <TextField
        label="Working on (optional)"
        value={focus}
        onChangeText={(value) => updateField(setFocus, value)}
        editable={!pending && !ambiguous}
        placeholder="reading confidence"
      />
      {error ? <InlineError message={error} /> : null}
      {receipt ? (
        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody }}>
          {receipt}
        </Text>
      ) : null}
      <Button
        label={pending ? "One moment\u2026" : ambiguous ? "Check again" : "Add child"}
        onPress={() => void submit()}
        busy={pending}
      />
    </View>
  );

  return embedded ? content : <Card style={{ gap: space.md }}>{content}</Card>;
}
