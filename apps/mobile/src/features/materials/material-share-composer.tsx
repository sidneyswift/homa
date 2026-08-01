import { useState } from "react";
import { Text, TextInput, View } from "react-native";

import { Button } from "../../components/ui/button";
import { emitFamilyEvent } from "../../lib/events";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, radius, space } from "../../theme/tokens";
import { runPreparedMaterialShare } from "./material-share";
import type { PreparedMaterialShareRequest } from "./material-share-contract";

export function MaterialShareComposer({
  request,
  familyId,
  onResult,
}: {
  request: PreparedMaterialShareRequest;
  familyId?: string | null;
  onResult?: (result: Awaited<ReturnType<typeof runPreparedMaterialShare>>) => void;
}) {
  const [message, setMessage] = useState(request.suggestedMessage);
  const [sharing, setSharing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function share() {
    setSharing(true);
    setNotice(null);
    const result = await runPreparedMaterialShare(request, message);
    setSharing(false);
    setNotice(result.message);
    if (familyId) {
      void emitFamilyEvent(familyId, "materials.share_result", {
        family_id: familyId,
        material_id: request.materialId,
        outcome: result.status === "handed-off" ? "handed_off" : result.status,
        ...(result.status === "failed" ? { reason: result.reason } : {}),
      });
    }
    onResult?.(result);
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong }}>
        Add a note
      </Text>
      <TextInput
        accessibilityLabel="Message to share with the printable"
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={500}
        style={{
          minHeight: 88,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: radius.md,
          backgroundColor: colors.page,
          padding: space.sm,
          fontFamily: fontFamilies.body,
          fontSize: fontSize.base,
          color: colors.textBody,
          textAlignVertical: "top",
        }}
      />
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
        Your chosen app and account will send this. Homa only hands over the PDF and note.
      </Text>
      <Button
        label={sharing ? "Opening share choices…" : "Choose an app"}
        disabled={sharing || message.trim().length === 0}
        onPress={() => void share()}
      />
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
          {notice}
        </Text>
      ) : null}
    </View>
  );
}
