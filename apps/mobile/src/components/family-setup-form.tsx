import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { InlineError } from "./ui/inline-error";
import { TextField } from "./ui/text-field";
import { reportCrash } from "../lib/crash-reporting";
import { createMyFamily } from "../lib/family";
import { useAccessibilityAnnouncement } from "../lib/accessibility";
import { fontFamilies } from "../theme/fonts";
import { colors, fontSize, space } from "../theme/tokens";

const RECEIPT_DISPLAY_MS = 700;

function waitForReceipt(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, RECEIPT_DISPLAY_MS);
  });
}

export function FamilySetupForm({
  onCreated,
  embedded = false,
}: {
  onCreated: () => Promise<void>;
  embedded?: boolean;
}) {
  const [parentName, setParentName] = useState("");
  const [familyName, setFamilyName] = useState("Our family");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  useAccessibilityAnnouncement(receipt ?? error);

  async function submit() {
    if (!parentName.trim()) {
      setError("Tell Homa what to call you first.");
      return;
    }
    setPending(true);
    setError(null);
    setReceipt(null);
    try {
      await createMyFamily({ familyName, parentName });
      setReceipt("Your family is started. Next, add a learner.");
      await waitForReceipt();
      await onCreated();
    } catch (cause) {
      reportCrash(cause, {
        surface: "native-onboarding",
        operation: "create-family",
      });
      setError(
        "Homa could not confirm your family yet. Nothing changed. Try again when you are ready.",
      );
      // A timeout may follow a successful server commit. Reloading lets the
      // gate move to the child step without asking the parent to create twice.
      await onCreated().catch((reconcileCause) => {
        reportCrash(reconcileCause, {
          surface: "native-onboarding",
          operation: "reconcile-family-create",
        });
      });
    } finally {
      setPending(false);
    }
  }

  const content = (
    <View style={{ gap: space.md }}>
      <Text
        style={{
          fontFamily: fontFamilies.body,
          fontSize: fontSize.sm,
          lineHeight: 20,
          color: colors.textMuted,
        }}
      >
        One name for you and one name for your family is enough to begin. You can change both later.
      </Text>
      <TextField
        label="What should I call you?"
        value={parentName}
        onChangeText={setParentName}
        autoCapitalize="words"
        autoComplete="name"
        placeholder="Maria"
        maxLength={80}
      />
      <TextField
        label="Family name"
        value={familyName}
        onChangeText={setFamilyName}
        autoCapitalize="words"
        placeholder="Our family"
        maxLength={80}
      />
      {error ? <InlineError message={error} /> : null}
      {receipt ? (
        <Text
          style={{
            fontFamily: fontFamilies.bodyMedium,
            fontSize: fontSize.sm,
            color: colors.textBody,
          }}
        >
          {receipt}
        </Text>
      ) : null}
      <Button
        label={pending ? "Starting…" : "Start with Homa"}
        onPress={() => void submit()}
        busy={pending}
        disabled={pending}
      />
    </View>
  );

  return embedded ? content : <Card style={{ gap: space.md }}>{content}</Card>;
}
