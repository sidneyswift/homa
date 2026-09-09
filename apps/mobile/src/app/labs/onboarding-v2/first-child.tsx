import { useRouter } from "expo-router";
import { useState } from "react";
import { Keyboard, Pressable, View } from "react-native";

import { OnboardingStage } from "../../../features/onboarding-v2/Stage";
import { PrimaryButton, TextField } from "../../../features/onboarding-v2/controls";
import { SelectField } from "../../../features/onboarding-v2/SelectField";
import { useOnboardingV2, type V2Kid } from "../../../features/onboarding-v2/state";
import { v2Colors, v2Radii, v2Space, v2Type } from "../../../features/onboarding-v2/theme";
import { NativeText } from "../../../components/ui/semantic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const CAP = 5;
const MONTH_OPTIONS = MONTHS.map((label, index) => ({ label, value: index + 1 }));

/** Client-only lab: the save actions keep details in the lab provider. */
export default function FirstChildScreen() {
  const router = useRouter();
  const { state, addKid, update } = useOnboardingV2();
  const [showForm, setShowForm] = useState(state.kids.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const today = new Date();
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 18 }, (_, index) => ({ label: String(currentYear - index), value: currentYear - index }));
  const futureBirth = year === currentYear && month !== null && month > today.getMonth() + 1;
  const hasDraft = name.trim().length > 0 || month !== null || year !== null;
  const canSave = name.trim().length > 0 && month !== null && year !== null && !futureBirth;
  const savesDraft = showForm && hasDraft;
  const canContinue = savesDraft ? canSave : state.kids.length > 0;
  const countAfterSave = state.kids.length + (savesDraft && !editingId ? 1 : 0);
  const canAddAnother = (!showForm || canSave) && countAfterSave < CAP;

  function clearForm() {
    setName("");
    setMonth(null);
    setYear(null);
    setEditingId(null);
  }

  function saveDraft() {
    if (!canSave || month === null || year === null) return;
    const kid = { name: name.trim(), birthMonth: month, birthYear: year };
    if (editingId) {
      update("kids", state.kids.map((existing) => existing.id === editingId ? { ...existing, ...kid } : existing));
    } else if (state.kids.length < CAP) {
      addKid(kid);
    }
    clearForm();
  }

  function continueWithChildren() {
    if (!canContinue) return;
    if (savesDraft) saveDraft();
    setShowForm(false);
    Keyboard.dismiss();
    router.push("/labs/onboarding-v2/relationship");
  }

  function addAnother() {
    if (!canAddAnother) return;
    if (savesDraft) saveDraft();
    else clearForm();
    Keyboard.dismiss();
    setShowForm(true);
  }

  function editKid(kid: V2Kid) {
    setEditingId(kid.id);
    setName(kid.name);
    setMonth(kid.birthMonth);
    setYear(kid.birthYear);
    setShowForm(true);
  }

  return (
    <OnboardingStage
      posture="docked"
      compact
      showLabControls={false}
      progressLabel={state.familyName ? `The ${state.familyName} family` : "Your family"}
      characterState="listening"
      onBack={() => router.back()}
      bubbleTail="left"
      bubbleKey="first-child"
      bubble="Let's add your children."
      footer={
        <View style={{ gap: v2Space.sm }}>
          {countAfterSave < CAP ? (
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canAddAnother }} disabled={!canAddAnother}
              onPress={addAnother} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}>
              <NativeText style={[v2Type.control, { color: canAddAnother ? v2Colors.coral : v2Colors.inkMuted }]}>
                {savesDraft ? "+ Save and add another" : "+ Add another child"}
              </NativeText>
            </Pressable>
          ) : null}
          <PrimaryButton label={savesDraft ? "Save and continue" : "Continue"} onPress={continueWithChildren} disabled={!canContinue} />
        </View>
      }
    >
      <View style={{ gap: v2Space.lg }}>
        {state.kids.length > 0 ? (
          <View style={{ gap: v2Space.sm }}>
            {state.kids.map((kid) => (
              <View key={kid.id} style={{ flexDirection: "row", alignItems: "center", gap: v2Space.sm,
                borderRadius: v2Radii.control, backgroundColor: v2Colors.paper,
                paddingHorizontal: v2Space.md, paddingVertical: v2Space.sm }}>
                <View style={{ flex: 1 }}>
                  <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>{kid.name}</NativeText>
                  <NativeText style={[v2Type.caption, { color: v2Colors.inkMuted }]}>
                    {MONTHS[kid.birthMonth - 1]} {kid.birthYear}
                  </NativeText>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${kid.name}`}
                  disabled={showForm && hasDraft} accessibilityState={{ disabled: showForm && hasDraft }}
                  onPress={() => editKid(kid)} style={{ minHeight: 44, minWidth: 44, justifyContent: "center", alignItems: "center" }}>
                  <NativeText style={[v2Type.caption, { color: showForm && hasDraft ? v2Colors.inkMuted : v2Colors.coral }]}>Edit</NativeText>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {showForm ? (
          <View style={{ gap: v2Space.lg }}>
            <View style={{ gap: v2Space.sm }}>
              <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>Child&apos;s first name</NativeText>
              <TextField value={name} onChangeText={setName} placeholder="e.g. Maya" accessibilityLabel="Child's first name" />
            </View>
            <View style={{ gap: v2Space.sm }}>
              <NativeText style={[v2Type.chip, { color: v2Colors.ink }]}>Birth month and year</NativeText>
              <View style={{ flexDirection: "row", gap: v2Space.sm }}>
                <SelectField label="Month" value={month} options={MONTH_OPTIONS} onSelect={setMonth} />
                <SelectField label="Year" value={year} options={years} onSelect={setYear} />
              </View>
              {futureBirth ? (
                <NativeText accessibilityLiveRegion="polite" style={[v2Type.caption, { color: v2Colors.danger }]}>
                  That birth date is in the future. Check the month and year.
                </NativeText>
              ) : null}
            </View>
            {state.kids.length > 0 ? (
              <Pressable accessibilityRole="button" onPress={() => { clearForm(); setShowForm(false); Keyboard.dismiss(); }}
                style={{ minHeight: 44, justifyContent: "center" }}>
                <NativeText style={[v2Type.caption, { color: v2Colors.coral, textAlign: "center" }]}>
                  {editingId ? "Cancel changes" : "Cancel new child"}
                </NativeText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

      </View>
    </OnboardingStage>
  );
}
