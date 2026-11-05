import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { activityPlanRevisionRequest, selectedPlanActivities, type ActivityPlan } from "@homa/core";
import { useNativeWorkspace } from "../workspace/context";
import { useAccessibilityAnnouncement } from "../../lib/accessibility";
import { colors, fontFamilies } from "../../theme/app2";

export function ActivityPlanCard({ id, title, plan, childName, prepareQuestion }: { id: string; title: string; plan: ActivityPlan; childName: string | null; prepareQuestion?: (text: string) => void }) {
  const [draft, setDraft] = useState(plan);
  const workspace = useNativeWorkspace();
  useAccessibilityAnnouncement(draft.minutes !== plan.minutes ? `${draft.minutes} minutes` : null);
  const ask = prepareQuestion ?? workspace?.prepareQuestion;
  const changed = draft.minutes !== plan.minutes || [...draft.swapped].sort().join() !== [...plan.swapped].sort().join();
  const body = { color: colors.textBody, fontFamily: fontFamilies.body, fontSize: 16, lineHeight: 24 };
  const action = (label: string, onPress: () => void, disabled = false, selected?: boolean) => <Pressable accessibilityRole="button" accessibilityState={{ disabled, ...(selected !== undefined ? { selected } : {}) }} disabled={disabled} onPress={onPress} style={{ minHeight: 44, justifyContent: "center", opacity: disabled ? 0.45 : 1 }}><Text style={{ ...body, textDecorationLine: "underline" }}>{label}</Text></Pressable>;
  return <View style={{ backgroundColor: colors.page, paddingVertical: 20, gap: 16 }}>
    <Text accessibilityRole="header" style={{ ...body, fontFamily: fontFamilies.bodySemibold, fontSize: 22, lineHeight: 28 }}>{title}</Text>
    {childName ? <Text style={body}>For {childName}</Text> : null}
    <Text style={body}>{plan.introduction}</Text>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
      {action("5 minutes less", () => setDraft(value => ({ ...value, minutes: Math.max(10, value.minutes - 5) })), draft.minutes <= 10)}
      <Text style={body}>{draft.minutes} minutes</Text>
      {action("5 minutes more", () => setDraft(value => ({ ...value, minutes: Math.min(60, value.minutes + 5) })), draft.minutes >= 60)}
    </View>
    {selectedPlanActivities(draft).map(item => <View key={item.id} style={{ gap: 8, paddingVertical: 12 }}>
      <Text accessibilityRole="header" style={{ ...body, fontFamily: fontFamilies.bodySemibold }}>{item.title} · {item.minutes} min</Text>
      <Text style={body}>{item.instructions}</Text>
      {item.materials.length ? <Text style={{ ...body, color: colors.textMuted }}>Gather: {item.materials.join(", ")}</Text> : null}
      {action(draft.swapped.includes(item.id) ? "Use original" : "Try another idea", () => setDraft(value => ({ ...value, swapped: value.swapped.includes(item.id) ? value.swapped.filter(id => id !== item.id) : [...value.swapped, item.id] })), false, draft.swapped.includes(item.id))}
      {action("Help us get started", () => ask?.(`Help us try "${item.title}" from saved material ${id}. ${item.instructions} Give one small first step. This is preparation, not completed learning.`), !ask)}
    </View>)}
    {changed ? <>
      <Text style={{ ...body, color: colors.textMuted }}>These changes are not saved yet. Send the request to ask Homa to save a new version.</Text>
      {action("Ask Homa to save changes", () => ask?.(activityPlanRevisionRequest(id, draft)), !ask)}
      {action("Reset changes", () => setDraft(plan))}
    </> : <Text style={{ ...body, color: colors.textMuted }}>This version is saved. Trying an activity does not log learning or time.</Text>}
    {action("Make it simpler", () => ask?.(`Reopen saved activity plan ${id} and make it simpler using my current choices: ${draft.minutes} minutes; selected alternatives: ${draft.swapped.join(", ") || "none"}. Preserve the learning objective.`), !ask)}
  </View>;
}
