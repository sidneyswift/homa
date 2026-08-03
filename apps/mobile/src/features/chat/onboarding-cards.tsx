import * as WebBrowser from "expo-web-browser";
import { Check, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HOMESCHOOL_STYLES, MAP_SUBJECTS, US_STATES } from "@homa/core";

import { Logo } from "../../components/brand/logo";
import { AccessibleModal } from "../../components/ui/accessible-modal";
import { Button } from "../../components/ui/button";
import { IconButton } from "../../components/ui/icon-button";
import { LoadingStatus } from "../../components/ui/loading-status";
import { TextField } from "../../components/ui/text-field";
import { useAccessibilityFocusOnChange } from "../../lib/accessibility";
import { fontFamilies } from "../../theme/fonts";
import { colors, fontSize, lineHeightFor, radius, space } from "../../theme/tokens";
import { MaterialCard } from "./material-card";
import {
  fetchMapChild,
  fetchMakingStatus,
  finalizeReport,
  recordReportReveal,
  reportNarrativeSettled,
  reportUrl,
  saveDetailCard,
} from "./onboarding-card-api";
import {
  birthDateFromParts,
  checklistPositionFor,
  commaSeparatedValues,
  spokenDate,
  type ChecklistCardData,
  type DetailCardData,
  type FirstMakingCardData,
  type ReportCardData,
} from "./onboarding-card-model";

const STYLE_LABELS: Record<(typeof HOMESCHOOL_STYLES)[number], string> = {
  montessori: "Montessori",
  charlotte_mason: "Charlotte Mason",
  classical: "Classical",
  reggio: "Reggio",
  waldorf: "Waldorf",
  unit_studies: "Unit studies",
  unschooling: "Unschooling",
  eclectic: "Eclectic",
  traditional: "Traditional",
};

function Receipt({ label, detail }: { label: string; detail: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        borderRadius: radius.pill,
        backgroundColor: colors.sageSoft,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.success }}>
        {label}
      </Text>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textBody }}>
        {detail}
      </Text>
    </View>
  );
}

export function ChecklistCard({
  card,
  active,
  onOpen,
}: {
  card: ChecklistCardData;
  active: boolean;
  onOpen?: (childId: string) => void;
}) {
  const [live, setLive] = useState<ReturnType<typeof checklistPositionFor> | null>(null);

  useEffect(() => {
    let current = true;
    void fetchMapChild(card.childId)
      .then((child) => {
        if (current) setLive(checklistPositionFor(child));
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [card.childId]);

  const answered = live?.answered ?? card.answered;
  const remaining = live?.remaining ?? card.remaining;
  const minutesLeft = live?.minutesLeft ?? card.minutesLeft;
  const complete = live?.complete ?? false;
  const total = answered + remaining;
  const progress = total > 0 ? `${Math.round((answered / total) * 100)}%` as const : "0%";

  if (!active || complete) {
    return (
      <Receipt
        label={complete ? "Questions done" : answered > 0 ? "Questions started" : "Questions ready"}
        detail={`${card.childName}${answered > 0 ? `, ${answered} ${answered === 1 ? "answer" : "answers"}` : ""}`}
      />
    );
  }

  return (
    <View accessibilityLabel={`${card.childName}'s questions`} style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
        <Text
          style={{
            borderRadius: radius.pill,
            backgroundColor: colors.brandSoft,
            paddingHorizontal: 10,
            paddingVertical: 5,
            fontFamily: fontFamilies.bodySemibold,
            fontSize: fontSize.xs,
            color: colors.textStrong,
          }}
        >
          {card.childName}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
          {remaining <= 1 ? "almost done" : `about ${minutesLeft} min${answered > 0 ? " left" : ""}`}
        </Text>
      </View>
      <View style={{ height: 4, overflow: "hidden", borderRadius: radius.pill, backgroundColor: colors.borderSubtle }}>
        <View style={{ width: progress, height: 4, backgroundColor: colors.brand }} />
      </View>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted }}>
        {answered > 0
          ? `You have given me ${answered} ${answered === 1 ? "answer" : "answers"} about ${card.childName}. You can stop whenever you like.`
          : `Even five answers about ${card.childName} tell me a lot. You can stop whenever you like.`}
      </Text>
      <Button
        label={card.resumed || answered > 0 ? "Pick up where you left off" : "Start the questions"}
        icon={<Logo size={18} variant="mark" />}
        onPress={() => onOpen?.(card.childId)}
        disabled={onOpen === undefined}
      />
    </View>
  );
}

interface DetailField {
  key: string;
  label: (values: Record<string, string>) => string;
  kind: "text" | "state" | "date" | "styles" | "interests";
  optional?: boolean;
}

const DETAIL_FIELDS: Record<DetailCardData["kind"], DetailField[]> = {
  family_basics: [
    { key: "callMeName", label: () => "What should I call you?", kind: "text" },
    { key: "usState", label: () => "Which state are you in?", kind: "state" },
  ],
  homeschool_profile: [
    {
      key: "homeschoolStyles",
      label: () => "Any particular homeschool approach you follow?",
      kind: "styles",
      optional: true,
    },
  ],
  child: [
    { key: "childName", label: () => "What is your child's first name?", kind: "text" },
    { key: "birthDate", label: (values) => `When was ${values.childName || "your child"} born?`, kind: "date" },
    {
      key: "childInterests",
      label: (values) => `What does ${values.childName || "your child"} love right now?`,
      kind: "interests",
      optional: true,
    },
  ],
};

function fieldReady(field: DetailField, values: Record<string, string>): boolean {
  if (field.optional) return true;
  const value = values[field.key]?.trim() ?? "";
  if (field.kind === "state") {
    return US_STATES.some((state) => state.code === value.toUpperCase());
  }
  return value.length > 0;
}

function detailSummary(card: DetailCardData, values: Record<string, string>): string {
  if (card.kind === "family_basics") {
    const state = US_STATES.find((entry) => entry.code === values.usState.toUpperCase());
    return `${values.callMeName.trim()}, ${state?.name ?? values.usState.toUpperCase()}`;
  }
  if (card.kind === "homeschool_profile") {
    const labels = commaSeparatedValues(values.homeschoolStyles)
      .map((value) => STYLE_LABELS[value as keyof typeof STYLE_LABELS] ?? value);
    return labels.length > 0 ? labels.join(", ") : "Nothing in particular, noted";
  }
  const interests = commaSeparatedValues(values.childInterests);
  const base = `${values.childName.trim()}, born ${spokenDate(values.birthDate)}`;
  return interests.length > 0 ? `${base}, loves ${interests.join(", ")}` : base;
}

export function DetailCard({
  card,
  active,
  onSaved,
}: {
  card: DetailCardData;
  active: boolean;
  onSaved?: (summary: string) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    callMeName: "",
    usState: "",
    homeschoolStyles: "",
    childName: "",
    birthDate: "",
    childInterests: "",
  });
  const [birth, setBirth] = useState({ year: "", month: "", day: "" });
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choosingState, setChoosingState] = useState(false);
  const fields = DETAIL_FIELDS[card.kind];
  const field = fields[Math.min(step, fields.length - 1)];
  const isLast = step === fields.length - 1;
  const fieldHeadingRef = useRef<View>(null);
  const statePickerHeadingRef = useRef<View>(null);
  useAccessibilityFocusOnChange(
    fieldHeadingRef,
    active && !saved ? `${card.kind}:${step}` : null,
  );
  const resolvedValues = {
    ...values,
    birthDate: birthDateFromParts(birth) ?? "",
  };

  if (saved) {
    return <Receipt label={card.kind === "child" ? "Added" : "Saved"} detail={saved} />;
  }
  if (!active) {
    return (
      <Receipt
        label="Details card"
        detail={card.kind === "child" ? "About your child" : card.kind === "family_basics" ? "About you" : "About your homeschool"}
      />
    );
  }

  function setValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function toggleStyle(value: string) {
    const current = commaSeparatedValues(values.homeschoolStyles);
    setValue(
      "homeschoolStyles",
      current.includes(value)
        ? current.filter((entry) => entry !== value).join(",")
        : [...current, value].join(","),
    );
  }

  async function advance() {
    if (!fieldReady(field, resolvedValues) || saving) return;
    if (!isLast) {
      setStep((current) => current + 1);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveDetailCard(card, resolvedValues);
      const summary = detailSummary(card, resolvedValues);
      setSaved(summary);
      onSaved?.(summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That did not save. Nothing is lost, so try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <View accessibilityLabel="Details" style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Logo size={17} variant="mark" />
        <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
          {card.kind === "child" ? "About your child" : card.kind === "family_basics" ? "About you" : "About your homeschool"}
        </Text>
      </View>
      {card.intro ? (
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted }}>
          {card.intro}
        </Text>
      ) : null}
      <View
        ref={fieldHeadingRef}
        accessible
        accessibilityRole="header"
        accessibilityLabel={`${field.label(resolvedValues)}. Step ${step + 1} of ${fields.length}`}
      >
        <Text style={{ fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.textStrong }}>
          {field.label(resolvedValues)}
        </Text>
      </View>
      {field.kind === "date" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          <View style={{ flex: 1.3, minWidth: 88 }}>
            <TextField label="Year" value={birth.year} onChangeText={(year) => setBirth((current) => ({ ...current, year }))} keyboardType="number-pad" maxLength={4} placeholder="2019" />
          </View>
          <View style={{ flex: 1, minWidth: 72 }}>
            <TextField label="Month" value={birth.month} onChangeText={(month) => setBirth((current) => ({ ...current, month }))} keyboardType="number-pad" maxLength={2} placeholder="4" />
          </View>
          <View style={{ flex: 1, minWidth: 72 }}>
            <TextField label="Day" value={birth.day} onChangeText={(day) => setBirth((current) => ({ ...current, day }))} keyboardType="number-pad" maxLength={2} placeholder="7" />
          </View>
        </View>
      ) : field.kind === "styles" ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
          {HOMESCHOOL_STYLES.map((style) => {
            const selected = commaSeparatedValues(values.homeschoolStyles).includes(style);
            return (
              <Pressable
                key={style}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleStyle(style)}
                style={{
                  borderRadius: radius.pill,
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: space.xs,
                  borderWidth: 1,
                  borderColor: selected ? colors.brand : colors.border,
                  backgroundColor: selected ? colors.brandSoft : colors.card,
                  paddingHorizontal: 11,
                  paddingVertical: 8,
                }}
              >
                {selected ? (
                  <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    <Check size={14} color={colors.brandHover} />
                  </View>
                ) : null}
                <Text style={{ fontFamily: selected ? fontFamilies.bodySemibold : fontFamilies.body, fontSize: fontSize.sm, color: colors.textStrong }}>
                  {STYLE_LABELS[style]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : field.kind === "state" ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a state"
            onPress={() => setChoosingState(true)}
            style={({ pressed }) => ({
              minHeight: 48,
              justifyContent: "center",
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: pressed ? colors.brand : colors.border,
              backgroundColor: colors.card,
              paddingHorizontal: space.md,
            })}
          >
            <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.base, color: values.usState ? colors.textStrong : colors.textMuted }}>
              {US_STATES.find((state) => state.code === values.usState)?.name ?? "Pick one"}
            </Text>
          </Pressable>
          <AccessibleModal
            visible={choosingState}
            title="Choose your state"
            initialFocusRef={statePickerHeadingRef}
            presentationStyle="pageSheet"
            onRequestClose={() => setChoosingState(false)}
          >
            <SafeAreaView style={{ flex: 1, backgroundColor: colors.page }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: space.md, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
                <View ref={statePickerHeadingRef} accessible accessibilityRole="header" accessibilityLabel="Choose your state" style={{ flex: 1 }}>
                  <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong }}>
                    Choose your state
                  </Text>
                </View>
                <IconButton label="Close state picker" onPress={() => setChoosingState(false)}>
                  <X size={22} color={colors.textSubtle} />
                </IconButton>
              </View>
              <ScrollView contentContainerStyle={{ padding: space.md }}>
                {US_STATES.map((state) => {
                  const selected = state.code === values.usState;
                  return (
                    <Pressable
                      key={state.code}
                      accessibilityRole="button"
                      accessibilityLabel={state.name}
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setValue("usState", state.code);
                        setChoosingState(false);
                      }}
                      style={{
                        minHeight: 48,
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        borderBottomWidth: 1,
                        borderBottomColor: colors.borderSubtle,
                        paddingHorizontal: space.sm,
                        backgroundColor: selected ? colors.brandSoft : "transparent",
                      }}
                    >
                      <Text style={{ flex: 1, fontFamily: selected ? fontFamilies.bodySemibold : fontFamilies.body, fontSize: fontSize.base, color: colors.textStrong }}>
                        {state.name}
                      </Text>
                      {selected ? (
                        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                          <Check size={18} color={colors.brandHover} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </SafeAreaView>
          </AccessibleModal>
        </>
      ) : (
        <TextField
          label={field.kind === "interests" ? "Interests, separated by commas" : "Your answer"}
          value={values[field.key]}
          onChangeText={(value) => setValue(field.key, value)}
          autoCapitalize="words"
          maxLength={120}
          placeholder={field.kind === "interests" ? "Dinosaurs, drawing" : undefined}
        />
      )}
      {error ? (
        <Text accessibilityRole="alert" style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textBody }}>
          {error}
        </Text>
      ) : null}
      <Button
        label={saving ? "Saving…" : isLast ? card.kind === "child" ? `Add ${values.childName || "child"}` : "Got it" : "Next"}
        onPress={() => void advance()}
        disabled={!fieldReady(field, resolvedValues) || saving || onSaved === undefined}
      />
      {fields.length > 1 ? (
        <View accessibilityElementsHidden style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {fields.map((entry, index) => (
            <View key={entry.key} style={{ width: 7, height: 7, borderRadius: radius.pill, backgroundColor: index === step ? colors.brand : colors.border }} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const NARRATIVE_POLL_MS = 2500;

export function ReportRevealCard({
  card,
  active,
}: {
  card: ReportCardData;
  active: boolean;
}) {
  const startedRef = useRef(false);
  const [narrativeReady, setNarrativeReady] = useState(!active || card.alreadyScored);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (!card.alreadyScored) void finalizeReport(card.childId).catch(() => undefined);
    if (active) void recordReportReveal(card.token).catch(() => undefined);
  }, [active, card.alreadyScored, card.childId, card.token]);

  useEffect(() => {
    if (!active || narrativeReady) return;
    let current = true;
    async function poll() {
      const settled = await reportNarrativeSettled(card.token).catch(() => false);
      if (current && settled) setNarrativeReady(true);
    }
    void poll();
    const timer = setInterval(() => void poll(), NARRATIVE_POLL_MS);
    return () => {
      current = false;
      clearInterval(timer);
    };
  }, [active, card.token, narrativeReady]);

  if (!active) {
    return <Receipt label="Progress report ready" detail={card.childName} />;
  }

  return (
    <View accessibilityLabel={`${card.childName}'s progress report`} style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
        <Text style={{ borderRadius: radius.pill, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 5, fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textStrong }}>
          {card.childName}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
          {card.mappedSubjects} subjects covered
        </Text>
      </View>
      <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, lineHeight: 24, color: colors.textStrong }}>
        {narrativeReady ? `${card.childName}'s progress report is ready.` : `${card.childName}'s numbers are in.`}
      </Text>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted }}>
        {narrativeReady
          ? `Built from your ${card.answered} ${card.answered === 1 ? "answer" : "answers"}.`
          : "I am still writing the words to go with them. Keep going, there is nothing to wait for."}
      </Text>
      {card.strengths.length > 0 && card.strengths.length < card.mappedSubjects ? (
        <View style={{ gap: space.sm }}>
          <Text style={{ fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textMuted }}>
            Strongest subjects right now
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {card.strengths.map((strength) => (
              <Text key={strength} style={{ borderRadius: radius.pill, backgroundColor: colors.sageSoft, paddingHorizontal: 10, paddingVertical: 5, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textBody }}>
                {strength}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      {!narrativeReady ? <LoadingStatus label="Writing your progress story" /> : null}
      {narrativeReady ? (
        <Button
          label="See the whole report"
          onPress={() => void WebBrowser.openBrowserAsync(reportUrl(card.token))}
        />
      ) : null}
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
        {`Sorted across ${MAP_SUBJECTS.length} subjects`}
      </Text>
    </View>
  );
}

const MAKING_POLL_MS = 20_000;
const MAKING_POLL_CAP_MS = 30 * 60_000;

export function FirstMakingCard({ card }: { card: FirstMakingCardData }) {
  const { fontScale } = useWindowDimensions();
  const [status, setStatus] = useState<Awaited<ReturnType<typeof fetchMakingStatus>>>(null);

  useEffect(() => {
    let current = true;
    let elapsed = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const ask = async () => {
      const next = await fetchMakingStatus(card.jobId);
      if (!current) return;
      if (next) setStatus(next);
      const settled = next?.phase === "ready" || next?.phase === "stopped";
      elapsed += MAKING_POLL_MS;
      if (!settled && elapsed < MAKING_POLL_CAP_MS) {
        timer = setTimeout(() => void ask(), MAKING_POLL_MS);
      }
    };
    void ask();

    return () => {
      current = false;
      if (timer) clearTimeout(timer);
    };
  }, [card.jobId]);

  const phase = status?.phase ?? "making";
  if (phase === "ready" && status?.material) {
    return (
      <View style={{ marginTop: space.sm }}>
        <MaterialCard
          material={{
            ...status.material,
            kind: status.material.kind ?? undefined,
          }}
        />
      </View>
    );
  }

  if (phase === "stopped") {
    return <Receipt label="Making stopped" detail={card.title} />;
  }

  return (
    <View
      accessibilityLabel={`${card.title}, being made`}
      style={{ gap: space.sm }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm }}>
        <Text style={{ borderRadius: radius.pill, backgroundColor: colors.brandSoft, paddingHorizontal: 10, paddingVertical: 5, fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.xs, color: colors.textStrong }}>
          {card.childName}
        </Text>
        <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textMuted }}>
          {phase === "stalled" ? "paused for now" : "being made"}
        </Text>
      </View>
      <Text style={{ fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, lineHeight: lineHeightFor(fontSize.lg, fontScale), color: colors.textStrong }}>
        {card.title}
      </Text>
      <Text style={{ fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: lineHeightFor(fontSize.sm, fontScale), color: colors.textMuted }}>
        {phase === "stalled"
          ? "This one hit a snag while building. Nothing is lost, and you can ask Homa about it whenever you like."
          : "Homa is drawing this now. It usually takes a few minutes, and it will land right here and in your Binder. You do not have to wait for it."}
      </Text>
      {phase === "making" ? <LoadingStatus label="Making your page" /> : null}
    </View>
  );
}
