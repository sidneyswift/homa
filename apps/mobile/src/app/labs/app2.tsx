import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CharacterStage } from "../../features/app2/character-stage";
import { colors, fontFamilies } from "../../theme/app2";

/**
 * Dev review of the App 2 character stage without signing in
 * (homa://labs/app2): idle, engaged and working states. Labs are stripped
 * from production bundles (metro.config.js).
 */
export default function App2StageLab() {
  const [engaged, setEngaged] = useState(false);
  const [working, setWorking] = useState(false);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
      <CharacterStage engaged={engaged} activity={working ? "Working on your request" : null} />
      {engaged ? <View style={{ flex: 1 }} /> : null}
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 24, padding: 16 }}>
        <Pressable accessibilityRole="button" onPress={() => setEngaged(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, color: colors.textStrong }}>{engaged ? "Idle" : "Engaged"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setWorking(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, color: colors.textStrong }}>{working ? "Done" : "Working"}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
