import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Logo } from "../../../components/brand/logo";
import { Icon } from "../../../components/design/icon";
import type { SemanticIconName } from "@homa/design/contract";
import { fontFamilies } from "../../../theme/fonts";
import { colors, fontSize, palette, radius, shadows, space } from "../../../theme/tokens";

type Direction = "floating" | "dock";
type Surface = "voice" | "planner" | "binder" | "preview" | "confirmation";
type VoiceState =
  | "listening"
  | "speaking"
  | "muted"
  | "paused"
  | "reconnecting"
  | "attention";

interface StateSpec {
  label: string;
  detail: string;
  color: string;
  soft: string;
  icon: SemanticIconName;
}

const SURFACES: readonly { id: Surface; label: string }[] = [
  { id: "voice", label: "Voice" },
  { id: "planner", label: "Planner" },
  { id: "binder", label: "Binder" },
  { id: "preview", label: "Preview" },
  { id: "confirmation", label: "Confirm" },
];

const STATE_SPECS: Record<VoiceState, StateSpec> = {
  listening: {
    label: "Listening",
    detail: "Homa can hear you",
    color: colors.sage,
    soft: colors.sageSoft,
    icon: "voice",
  },
  speaking: {
    label: "Speaking",
    detail: "Homa is answering",
    color: colors.brand,
    soft: colors.brandSoft,
    icon: "volume",
  },
  muted: {
    label: "Muted",
    detail: "Tap to turn your mic on",
    color: colors.textMuted,
    soft: colors.surfaceSunken,
    icon: "muted",
  },
  paused: {
    label: "Paused for recorder",
    detail: "The lesson recorder has the mic",
    color: palette.goldInk,
    soft: colors.goldSoft,
    icon: "pause",
  },
  reconnecting: {
    label: "Reconnecting",
    detail: "Your conversation is safe",
    color: palette.sky600,
    soft: palette.sky100,
    icon: "refresh",
  },
  attention: {
    label: "Needs your attention",
    detail: "One choice is waiting",
    color: palette.goldInk,
    soft: colors.goldSoft,
    icon: "reminder",
  },
};

function oneParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isDirection(value: string | undefined): value is Direction {
  return value === "floating" || value === "dock";
}

function isSurface(value: string | undefined): value is Surface {
  return SURFACES.some((item) => item.id === value);
}

function isVoiceState(value: string | undefined): value is VoiceState {
  return value !== undefined && value in STATE_SPECS;
}

/**
 * Disposable native interaction lab for gh#547. This file deliberately lives
 * outside `src/app`, so Expo Router cannot package it as a product route.
 * It carries no session, navigation, active-object, or product-data behavior.
 * Every record on it is synthetic. The branch is evidence only.
 */
export default function VoiceShell547Lab() {
  const params = useLocalSearchParams<{
    direction?: string;
    surface?: string;
    state?: string;
    panel?: string;
  }>();
  const insets = useSafeAreaInsets();
  const [direction, setDirection] = useState<Direction>(() => {
    const requested = oneParam(params.direction);
    return isDirection(requested) ? requested : "floating";
  });
  const [surface, setSurface] = useState<Surface>(() => {
    const requested = oneParam(params.surface);
    return isSurface(requested) ? requested : "voice";
  });
  const [voiceState, setVoiceState] = useState<VoiceState>(() => {
    const requested = oneParam(params.state);
    return isVoiceState(requested) ? requested : "listening";
  });
  const [controlExpanded, setControlExpanded] = useState(false);
  const [panelOpen, setPanelOpen] = useState(() => oneParam(params.panel) === "open");
  const [systemSheetOpen, setSystemSheetOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const controlReserve = direction === "dock" ? 92 + insets.bottom : 84 + insets.bottom;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.fill}
    >
      <SafeAreaView edges={["top"]} style={styles.safeRoot}>
        <LabTopBar
          direction={direction}
          state={voiceState}
          onOpenPanel={() => setPanelOpen(true)}
        />

        <View accessibilityRole="summary" style={styles.fakeDataNotice}>
          <Text style={styles.fakeDataText}>
            Issue #547 prototype · Fake family and records · No product actions
          </Text>
        </View>

        <View style={styles.stage}>
          <SurfaceFrame
            surface={surface}
            controlReserve={controlReserve}
            voiceState={voiceState}
            onOpenSystemSheet={() => setSystemSheetOpen(true)}
          />

          {!systemSheetOpen ? (
            <VoiceControl
              direction={direction}
              state={voiceState}
              expanded={controlExpanded || voiceState === "attention"}
              keyboardOpen={keyboardOpen}
              bottomInset={insets.bottom}
              onToggleExpanded={() => setControlExpanded((current) => !current)}
              onSetState={setVoiceState}
            />
          ) : null}
        </View>
      </SafeAreaView>

      <LabPanel
        visible={panelOpen}
        direction={direction}
        surface={surface}
        state={voiceState}
        onClose={() => setPanelOpen(false)}
        onDirection={(next) => {
          setDirection(next);
          setControlExpanded(false);
        }}
        onSurface={(next) => {
          Keyboard.dismiss();
          setSurface(next);
        }}
        onState={setVoiceState}
      />

      <SystemSheet
        visible={systemSheetOpen}
        state={voiceState}
        onClose={() => setSystemSheetOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

function LabTopBar({
  direction,
  state,
  onOpenPanel,
}: {
  direction: Direction;
  state: VoiceState;
  onOpenPanel: () => void;
}) {
  const spec = STATE_SPECS[state];
  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open menu, prototype only" style={styles.iconHit}>
        <Icon name="menu" size={24} color={colors.textBody} />
      </Pressable>
      <Logo size={24} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open lab controls. ${direction} direction, ${spec.label}`}
        onPress={onOpenPanel}
        style={styles.labButton}
      >
        <Icon name="settings" size={16} color={colors.brandHover} />
        <Text style={styles.labButtonText}>Lab</Text>
      </Pressable>
    </View>
  );
}

function SurfaceFrame({
  surface,
  controlReserve,
  voiceState,
  onOpenSystemSheet,
}: {
  surface: Surface;
  controlReserve: number;
  voiceState: VoiceState;
  onOpenSystemSheet: () => void;
}) {
  if (surface === "voice") {
    return <VoiceSurface controlReserve={controlReserve} voiceState={voiceState} />;
  }
  if (surface === "planner") {
    return <PlannerSurface controlReserve={controlReserve} />;
  }
  if (surface === "binder") {
    return <BinderSurface controlReserve={controlReserve} />;
  }
  if (surface === "preview") {
    return (
      <PreviewSurface
        controlReserve={controlReserve}
        onOpenSystemSheet={onOpenSystemSheet}
      />
    );
  }
  return <ConfirmationSurface controlReserve={controlReserve} />;
}

function VoiceSurface({ controlReserve, voiceState }: { controlReserve: number; voiceState: VoiceState }) {
  const spec = STATE_SPECS[voiceState];
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.surfaceContent, { paddingBottom: controlReserve }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.voiceHero}>
        <View style={[styles.voiceMarkHalo, { backgroundColor: spec.soft }]}>
          <Logo size={86} variant="mark" />
        </View>
        <Text style={styles.screenTitle}>Talk to Homa</Text>
        <Text style={styles.centerMuted}>Your conversation stays with you while you work.</Text>
      </View>

      <View style={styles.transcriptCard}>
        <Text style={styles.overline}>You</Text>
        <Text style={styles.bodyText}>Show me this week, and keep listening.</Text>
      </View>
      <View style={[styles.transcriptCard, styles.homaTranscript]}>
        <Text style={[styles.overline, { color: colors.brandHover }]}>Homa</Text>
        <Text style={styles.bodyText}>Planner is ready. I’m still with you.</Text>
      </View>
    </ScrollView>
  );
}

function PlannerSurface({ controlReserve }: { controlReserve: number }) {
  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.surfaceContent, { paddingBottom: controlReserve + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Segmented labels={["Day", "Week", "Month"]} selected="Week" />
        <View style={styles.dateRow}>
          <Icon name="back" size={20} color={colors.textMuted} />
          <View style={styles.centered}>
            <Text style={styles.sectionTitle}>Aug 3 to 9</Text>
            <Text style={styles.caption}>Everyone</Text>
          </View>
          <Text style={styles.todayText}>Today</Text>
        </View>

        <PlannerDay day="Monday" date="3" items={["Mia · Fractions", "Noah · Nature journal"]} />
        <PlannerDay day="Tuesday" date="4" items={["Family · Library", "Mia · Reading"]} />
        <PlannerDay day="Wednesday" date="5" items={["Noah · Math games"]} />
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add to planner"
        style={[styles.plannerFab, { bottom: controlReserve + space.sm }]}
      >
        <Text style={styles.plannerFabText}>+</Text>
      </Pressable>
    </View>
  );
}

function PlannerDay({ day, date, items }: { day: string; date: string; items: readonly string[] }) {
  return (
    <View style={styles.dayCard}>
      <View style={styles.dayDate}>
        <Text style={styles.overline}>{day}</Text>
        <Text style={styles.dayNumber}>{date}</Text>
      </View>
      <View style={styles.dayItems}>
        {items.map((item, index) => (
          <View key={item} style={[styles.planItem, index === 0 ? styles.planMint : styles.planSky]}>
            <View style={styles.checkCircle} />
            <Text style={styles.planItemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function BinderSurface({ controlReserve }: { controlReserve: number }) {
  const searchRef = useRef<TextInput>(null);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.fill}
      contentContainerStyle={[styles.surfaceContent, { paddingBottom: controlReserve }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headingBlock}>
        <Text style={styles.screenTitle}>Binder</Text>
        <Text style={styles.muted}>Everything Homa has made for your family.</Text>
      </View>
      <TextInput
        ref={searchRef}
        accessibilityLabel="Search your binder"
        placeholder="Search your binder"
        placeholderTextColor={colors.textSubtle}
        style={styles.searchInput}
      />
      <Text style={styles.keyboardHint}>Tap search to test the real keyboard clearance.</Text>
      <View style={styles.filterRow}>
        <Chip label="All" selected />
        <Chip label="Worksheets" />
        <Chip label="Reading" />
      </View>
      <View style={styles.materialGrid}>
        <MaterialTile title="Fraction picnic" child="Mia" tone={colors.goldSoft} icon="document" />
        <MaterialTile title="Backyard birds" child="Noah" tone={colors.sageSoft} icon="book" />
        <MaterialTile title="Story starters" child="Mia" tone={palette.sky100} icon="chat" />
        <MaterialTile title="Number hunt" child="Noah" tone={colors.brandSoft} icon="calendar" />
      </View>
    </ScrollView>
  );
}

function MaterialTile({
  title,
  child,
  tone,
  icon,
}: {
  title: string;
  child: string;
  tone: string;
  icon: SemanticIconName;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${title} for ${child}`} style={styles.materialTile}>
      <View style={[styles.materialPreview, { backgroundColor: tone }]}>
        <Icon name={icon} size={24} color={colors.textBody} />
        <View style={styles.previewLine} />
        <View style={[styles.previewLine, { width: "54%" }]} />
      </View>
      <Text numberOfLines={1} style={styles.materialTitle}>{title}</Text>
      <Text style={styles.caption}>{child}</Text>
    </Pressable>
  );
}

function PreviewSurface({
  controlReserve,
  onOpenSystemSheet,
}: {
  controlReserve: number;
  onOpenSystemSheet: () => void;
}) {
  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.surfaceContent, { paddingBottom: controlReserve + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Binder" style={styles.iconHit}>
            <Icon name="back" size={20} color={colors.textBody} />
          </Pressable>
          <View style={styles.flexOne}>
            <Text numberOfLines={1} style={styles.sectionTitle}>Fraction picnic</Text>
            <Text style={styles.caption}>Draft for Mia · 2 pages</Text>
          </View>
        </View>
        <View accessibilityLabel="Preview of Fraction picnic" style={styles.worksheetPage}>
          <Text style={styles.worksheetEyebrow}>MIA’S FRACTION PICNIC</Text>
          <Text style={styles.worksheetTitle}>Build each picnic plate</Text>
          <Text style={styles.worksheetCopy}>Shade the fraction, then write it below.</Text>
          <View style={styles.fractionRow}>
            <FractionPlate label="1/2" fill={2} />
            <FractionPlate label="3/4" fill={3} />
          </View>
          <View style={styles.answerLine} />
          <View style={styles.answerLine} />
          <Text style={styles.madeWith}>made with Homa for Mia</Text>
        </View>
      </ScrollView>
      <View style={[styles.stickyAction, { bottom: controlReserve }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open print options for two copies"
          onPress={onOpenSystemSheet}
          style={styles.primaryButton}
        >
          <Icon name="print" size={20} color={colors.onBrand} />
          <Text style={styles.primaryButtonText}>Print 2 copies</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FractionPlate({ label, fill }: { label: string; fill: number }) {
  return (
    <View style={styles.fractionBlock}>
      <View style={styles.fractionPlate}>
        {[0, 1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.fractionQuarter,
              index < fill ? styles.fractionFilled : null,
              index % 2 === 0 ? styles.quarterRight : null,
            ]}
          />
        ))}
      </View>
      <Text style={styles.fractionLabel}>{label}</Text>
    </View>
  );
}

function ConfirmationSurface({ controlReserve }: { controlReserve: number }) {
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.surfaceContent, { paddingBottom: controlReserve }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headingBlock}>
        <Text style={styles.screenTitle}>Save this observation?</Text>
        <Text style={styles.muted}>Nothing is saved until you choose.</Text>
      </View>
      <View style={styles.confirmCard}>
        <View style={styles.confirmIcon}>
          <Icon name="book" size={24} color={colors.sage} />
        </View>
        <View style={styles.flexOne}>
          <Text style={styles.overline}>NOAH · MATH</Text>
          <Text style={styles.confirmTitle}>Grouped by fives without prompting</Text>
        </View>
      </View>
      <View style={styles.evidenceBox}>
        <Text style={styles.overline}>VISIBLE EVIDENCE</Text>
        <Text style={styles.bodyText}>“Five, ten, fifteen, twenty,” while moving four groups of counters.</Text>
      </View>
      <Text style={styles.caption}>Today · Parent-confirmed observation · Not a mastery judgment</Text>
      <View style={styles.confirmActions}>
        <Pressable accessibilityRole="button" style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Change it</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.primaryButton}>
          <Icon name="check" size={20} color={colors.onBrand} />
          <Text style={styles.primaryButtonText}>Save observation</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function VoiceControl({
  direction,
  state,
  expanded,
  keyboardOpen,
  bottomInset,
  onToggleExpanded,
  onSetState,
}: {
  direction: Direction;
  state: VoiceState;
  expanded: boolean;
  keyboardOpen: boolean;
  bottomInset: number;
  onToggleExpanded: () => void;
  onSetState: (state: VoiceState) => void;
}) {
  const spec = STATE_SPECS[state];
  const icon = spec.icon;
  const actionState: VoiceState = state === "muted" ? "listening" : "muted";
  const actionLabel = state === "muted" ? "Turn microphone on" : "Mute microphone";

  if (direction === "dock") {
    return (
      <View
        accessibilityLabel={`Homa Voice dock. ${spec.label}. ${spec.detail}`}
        style={[styles.dock, { paddingBottom: Math.max(bottomInset, space.sm) }]}
      >
        <View style={[styles.controlMark, { borderColor: spec.color }]}>
          <Logo size={34} variant="mark" />
        </View>
        <View style={styles.flexOne}>
          <Text accessibilityLiveRegion="polite" style={styles.controlTitle}>{spec.label}</Text>
          <Text numberOfLines={1} style={styles.controlDetail}>{spec.detail}</Text>
        </View>
        {state === "reconnecting" ? <ActivityIndicator size="small" color={spec.color} /> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => onSetState(actionState)}
          style={styles.roundControl}
        >
          <Icon name={icon} size={20} color={spec.color} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Return to Voice" style={styles.returnButton}>
          <Icon name="chat" size={16} color={colors.onBrand} />
          <Text style={styles.returnButtonText}>Voice</Text>
        </Pressable>
      </View>
    );
  }

  if (!expanded) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Homa Voice. ${spec.label}. Tap for controls`}
        accessibilityHint="Expands mute and return controls"
        onPress={onToggleExpanded}
        style={[
          styles.floatingPuck,
          keyboardOpen ? styles.keyboardLiftedPuck : null,
          { bottom: Math.max(bottomInset, space.md), borderColor: spec.color },
        ]}
      >
        <Logo size={38} variant="mark" />
        <View style={[styles.stateDot, { backgroundColor: spec.color }]} />
      </Pressable>
    );
  }

  return (
    <View
      accessibilityLabel={`Expanded Homa Voice control. ${spec.label}. ${spec.detail}`}
      style={[
        styles.floatingExpanded,
        keyboardOpen ? styles.keyboardLiftedExpanded : null,
        { bottom: Math.max(bottomInset, space.md) },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Collapse Homa Voice controls"
        onPress={onToggleExpanded}
        style={[styles.controlMark, { borderColor: spec.color }]}
      >
        <Logo size={32} variant="mark" />
      </Pressable>
      <View style={styles.flexOne}>
        <Text accessibilityLiveRegion="polite" style={styles.controlTitle}>{spec.label}</Text>
        <Text numberOfLines={1} style={styles.controlDetail}>{spec.detail}</Text>
      </View>
      {state === "reconnecting" ? <ActivityIndicator size="small" color={spec.color} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        onPress={() => onSetState(actionState)}
        style={styles.roundControl}
      >
        <Icon name={icon} size={20} color={spec.color} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Return to Voice" style={styles.compactReturn}>
        <Icon name="chat" size={20} color={colors.onBrand} />
      </Pressable>
    </View>
  );
}

function LabPanel({
  visible,
  direction,
  surface,
  state,
  onClose,
  onDirection,
  onSurface,
  onState,
}: {
  visible: boolean;
  direction: Direction;
  surface: Surface;
  state: VoiceState;
  onClose: () => void;
  onDirection: (direction: Direction) => void;
  onSurface: (surface: Surface) => void;
  onState: (state: VoiceState) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.panelRoot}>
        <View style={styles.panelHeader}>
          <View>
            <Text style={styles.panelTitle}>Voice shell direction lab</Text>
            <Text style={styles.caption}>Issue #547 · Fake interaction evidence</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close lab controls" onPress={onClose} style={styles.iconHit}>
            <Icon name="close" size={24} color={colors.textBody} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.panelContent}>
          <ControlGroup label="Direction">
            <Segmented
              labels={["Floating", "Dock"]}
              selected={direction === "floating" ? "Floating" : "Dock"}
              onSelect={(label) => onDirection(label === "Floating" ? "floating" : "dock")}
            />
          </ControlGroup>
          <ControlGroup label="Surface">
            <View style={styles.wrapRow}>
              {SURFACES.map((item) => (
                <Chip
                  key={item.id}
                  label={item.label}
                  selected={surface === item.id}
                  onPress={() => onSurface(item.id)}
                />
              ))}
            </View>
          </ControlGroup>
          <ControlGroup label="Voice state">
            <View style={styles.stateGrid}>
              {(Object.keys(STATE_SPECS) as VoiceState[]).map((id) => {
                const item = STATE_SPECS[id];
                const icon = item.icon;
                return (
                  <Pressable
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: state === id }}
                    onPress={() => onState(id)}
                    style={[styles.stateChoice, state === id ? styles.stateChoiceSelected : null]}
                  >
                    <View style={[styles.stateChoiceIcon, { backgroundColor: item.soft }]}>
                      <Icon name={icon} size={16} color={item.color} />
                    </View>
                    <Text style={styles.stateChoiceLabel}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </ControlGroup>
          <ControlGroup label="Stress cases">
            <Text style={styles.panelCopy}>
              Tap Binder search for the real iOS keyboard. Open Preview, then Print 2 copies for a native page sheet. The Voice control moves with the keyboard and stays behind the sheet.
            </Text>
          </ControlGroup>
          <ControlGroup label="What this lab reveals">
            <ComparisonRow
              criterion="Discoverability"
              floating="Needs a clear state ring and first-use cue"
              dock="Status and controls are immediately legible"
            />
            <ComparisonRow
              criterion="Obstruction"
              floating="Small, but still needs a reserved safe lane"
              dock="Predictable because content always reserves its height"
            />
            <ComparisonRow
              criterion="One-handed reach"
              floating="Excellent when anchored low on the thumb side"
              dock="Good, with larger visible targets"
            />
            <ComparisonRow
              criterion="Continuity signal"
              floating="Homa feels present, state detail is hidden"
              dock="State and recovery are explicit"
            />
          </ControlGroup>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function SystemSheet({
  visible,
  state,
  onClose,
}: {
  visible: boolean;
  state: VoiceState;
  onClose: () => void;
}) {
  const spec = STATE_SPECS[state];
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.systemSheet}>
        <View style={styles.sheetHeader}>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.sectionTitle}>Printer options</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetPrintButton}>
            <Text style={styles.sheetPrintText}>Print</Text>
          </Pressable>
        </View>
        <View style={[styles.passiveVoiceNotice, { backgroundColor: spec.soft }]}>
          <View style={[styles.stateDotInline, { backgroundColor: spec.color }]} />
          <Text style={styles.passiveVoiceText}>Homa is {spec.label.toLowerCase()}. Voice controls return when this sheet closes.</Text>
        </View>
        <View style={styles.printPreviewMini}>
          <Icon name="document" size={24} color={colors.textMuted} />
          <View>
            <Text style={styles.sectionTitle}>Fraction picnic</Text>
            <Text style={styles.caption}>2 pages · 2 copies</Text>
          </View>
        </View>
        <SheetRow label="Printer" value="Choose a printer" />
        <SheetRow label="Copies" value="2" />
        <SheetRow label="Range" value="Pages 1 to 2" />
        <Text style={styles.sheetFootnote}>
          Native page-sheet simulation. No printer request is made.
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

function SheetRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sheetRow}>
      <Text style={styles.bodyText}>{label}</Text>
      <Text style={styles.sheetValue}>{value}</Text>
    </View>
  );
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.controlGroup}>
      <Text style={styles.groupLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ComparisonRow({
  criterion,
  floating,
  dock,
}: {
  criterion: string;
  floating: string;
  dock: string;
}) {
  return (
    <View style={styles.comparisonRow}>
      <Text style={styles.comparisonCriterion}>{criterion}</Text>
      <Text style={styles.comparisonText}><Text style={styles.comparisonLabel}>Floating: </Text>{floating}</Text>
      <Text style={styles.comparisonText}><Text style={styles.comparisonLabel}>Dock: </Text>{dock}</Text>
    </View>
  );
}

function Segmented({
  labels,
  selected,
  onSelect,
}: {
  labels: readonly string[];
  selected: string;
  onSelect?: (label: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {labels.map((label) => {
        const active = selected === label;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect?.(label)}
            style={[styles.segment, active ? styles.segmentActive : null]}
          >
            <Text style={[styles.segmentText, active ? styles.segmentTextActive : null]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({
  label,
  selected = false,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : null]}
    >
      <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  flexOne: { flex: 1 },
  safeRoot: { flex: 1, backgroundColor: colors.page },
  stage: { flex: 1, overflow: "hidden" },
  centered: { alignItems: "center" },
  topBar: {
    height: 56,
    paddingHorizontal: space.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSubtle,
    backgroundColor: colors.page,
  },
  iconHit: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  labButton: {
    minHeight: 44,
    paddingHorizontal: space.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.brandSoft,
  },
  labButtonText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.brandHover },
  fakeDataNotice: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: space.md,
    backgroundColor: colors.goldSoft,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gold500,
  },
  fakeDataText: { fontFamily: fontFamilies.bodyMedium, fontSize: 11, color: palette.goldInk, textAlign: "center" },
  surfaceContent: { padding: space.md, gap: space.md },
  headingBlock: { gap: space.xs },
  screenTitle: { fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong },
  sectionTitle: { fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong },
  muted: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted },
  centerMuted: { maxWidth: 280, fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textMuted, textAlign: "center" },
  caption: { fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle },
  bodyText: { fontFamily: fontFamilies.body, fontSize: fontSize.base, lineHeight: 22, color: colors.textBody },
  overline: { fontFamily: fontFamilies.bodyBold, fontSize: 10, letterSpacing: 0.7, color: colors.textSubtle },
  voiceHero: { alignItems: "center", gap: space.sm, paddingTop: space.xl, paddingBottom: space.md },
  voiceMarkHalo: { width: 146, height: 146, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  transcriptCard: { padding: space.md, gap: space.xs, borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.sm },
  homaTranscript: { backgroundColor: colors.brandSoft },
  segmented: { flexDirection: "row", padding: 3, borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  segment: { flex: 1, minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.card, ...shadows.sm },
  segmentText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textMuted },
  segmentTextActive: { color: colors.textStrong },
  dateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48 },
  todayText: { minWidth: 44, textAlign: "right", fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.brandHover },
  dayCard: { flexDirection: "row", gap: space.md, padding: space.md, borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.sm },
  dayDate: { width: 52, alignItems: "center", gap: 2 },
  dayNumber: { fontFamily: fontFamilies.display, fontSize: fontSize.xxl, color: colors.textStrong },
  dayItems: { flex: 1, gap: space.sm },
  planItem: { minHeight: 44, paddingHorizontal: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md },
  planMint: { backgroundColor: colors.sageSoft },
  planSky: { backgroundColor: palette.sky100 },
  planItemText: { flex: 1, fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody },
  checkCircle: { width: 18, height: 18, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.sage },
  plannerFab: { position: "absolute", right: space.md, width: 52, height: 52, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", backgroundColor: colors.brand, ...shadows.md },
  plannerFabText: { marginTop: -2, fontFamily: fontFamilies.body, fontSize: 30, color: colors.onBrand },
  searchInput: { minHeight: 48, paddingHorizontal: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.card, fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textBody },
  keyboardHint: { marginTop: -space.sm, fontFamily: fontFamilies.body, fontSize: 11, color: colors.textSubtle },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
  chip: { minHeight: 40, paddingHorizontal: space.md, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderSubtle },
  chipSelected: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  chipText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textMuted },
  chipTextSelected: { color: colors.brandHover },
  materialGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  materialTile: { width: "48%", minHeight: 190, padding: space.sm, gap: space.xs, borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.sm },
  materialPreview: { height: 126, padding: space.md, justifyContent: "center", gap: space.sm, borderRadius: radius.md },
  previewLine: { width: "76%", height: 5, borderRadius: radius.pill, backgroundColor: "rgba(51,46,41,0.18)" },
  materialTitle: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textStrong },
  previewHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  worksheetPage: { minHeight: 480, padding: space.lg, alignItems: "center", gap: space.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, ...shadows.sm },
  worksheetEyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: 11, letterSpacing: 1.3, color: colors.brandHover },
  worksheetTitle: { fontFamily: fontFamilies.display, fontSize: fontSize.xl, color: colors.textStrong, textAlign: "center" },
  worksheetCopy: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center" },
  fractionRow: { flexDirection: "row", gap: space.xl, paddingVertical: space.md },
  fractionBlock: { alignItems: "center", gap: space.sm },
  fractionPlate: { width: 92, height: 92, flexDirection: "row", flexWrap: "wrap", overflow: "hidden", borderRadius: radius.pill, borderWidth: 2, borderColor: colors.textBody },
  fractionQuarter: { width: "50%", height: "50%", borderBottomWidth: 1, borderColor: colors.textBody, backgroundColor: colors.card },
  quarterRight: { borderRightWidth: 1 },
  fractionFilled: { backgroundColor: palette.gold100 },
  fractionLabel: { fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong },
  answerLine: { width: "92%", height: 1, marginTop: space.md, backgroundColor: colors.border },
  madeWith: { marginTop: "auto", fontFamily: fontFamilies.bodyMedium, fontSize: 10, color: colors.textSubtle },
  stickyAction: { position: "absolute", left: space.md, right: space.md, paddingVertical: space.sm, backgroundColor: colors.page },
  primaryButton: { minHeight: 48, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, borderRadius: radius.pill, backgroundColor: colors.brand },
  primaryButtonText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.base, color: colors.onBrand },
  confirmCard: { padding: space.md, flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.lg, backgroundColor: colors.card, ...shadows.sm },
  confirmIcon: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.sageSoft },
  confirmTitle: { marginTop: 2, fontFamily: fontFamilies.displaySemibold, fontSize: fontSize.lg, color: colors.textStrong },
  evidenceBox: { padding: space.md, gap: space.sm, borderRadius: radius.lg, backgroundColor: colors.goldSoft },
  confirmActions: { gap: space.sm, marginTop: space.sm },
  secondaryButton: { minHeight: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  secondaryButtonText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.base, color: colors.textBody },
  floatingPuck: { position: "absolute", left: space.md, width: 62, height: 62, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 2, backgroundColor: colors.card, ...shadows.md },
  keyboardLiftedPuck: { left: space.md },
  stateDot: { position: "absolute", right: 2, bottom: 2, width: 14, height: 14, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.card },
  floatingExpanded: { position: "absolute", left: space.md, right: space.md, minHeight: 68, padding: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.card, ...shadows.md },
  keyboardLiftedExpanded: { left: space.md, right: space.md },
  controlMark: { width: 48, height: 48, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, borderWidth: 2, backgroundColor: colors.card },
  controlTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong },
  controlDetail: { fontFamily: fontFamilies.body, fontSize: 11, color: colors.textMuted },
  roundControl: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.surfaceSunken },
  compactReturn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.brand },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, minHeight: 82, paddingTop: space.sm, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.sm, borderTopWidth: 1, borderTopColor: colors.borderSubtle, backgroundColor: colors.card, ...shadows.md },
  returnButton: { minHeight: 44, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", gap: space.xs, borderRadius: radius.pill, backgroundColor: colors.brand },
  returnButtonText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.onBrand },
  panelRoot: { flex: 1, backgroundColor: colors.page },
  panelHeader: { padding: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  panelTitle: { fontFamily: fontFamilies.display, fontSize: fontSize.xl, color: colors.textStrong },
  panelContent: { padding: space.md, gap: space.lg, paddingBottom: space.xxl },
  controlGroup: { gap: space.sm },
  groupLabel: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong },
  wrapRow: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stateGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  stateChoice: { width: "48%", minHeight: 60, padding: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: colors.card },
  stateChoiceSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  stateChoiceIcon: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: radius.pill },
  stateChoiceLabel: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSize.sm, color: colors.textBody },
  panelCopy: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 20, color: colors.textMuted },
  comparisonRow: { paddingVertical: space.sm, gap: space.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
  comparisonCriterion: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.textStrong },
  comparisonText: { fontFamily: fontFamilies.body, fontSize: fontSize.sm, lineHeight: 19, color: colors.textMuted },
  comparisonLabel: { fontFamily: fontFamilies.bodySemibold, color: colors.textBody },
  systemSheet: { flex: 1, backgroundColor: "#F4F4F6" },
  sheetHeader: { minHeight: 58, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.card },
  cancelButton: { minWidth: 54, minHeight: 44, justifyContent: "center" },
  cancelText: { fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.base, color: colors.info },
  sheetPrintButton: { minWidth: 54, minHeight: 36, alignItems: "center", justifyContent: "center", borderRadius: radius.sm, backgroundColor: colors.info },
  sheetPrintText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSize.sm, color: colors.card },
  passiveVoiceNotice: { margin: space.md, padding: space.sm, flexDirection: "row", alignItems: "center", gap: space.sm, borderRadius: radius.md },
  stateDotInline: { width: 10, height: 10, borderRadius: radius.pill },
  passiveVoiceText: { flex: 1, fontFamily: fontFamilies.bodyMedium, fontSize: fontSize.sm, color: colors.textBody },
  printPreviewMini: { marginHorizontal: space.md, marginBottom: space.md, padding: space.md, flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.md, backgroundColor: colors.card },
  sheetRow: { minHeight: 54, marginHorizontal: space.md, paddingHorizontal: space.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle, backgroundColor: colors.card },
  sheetValue: { fontFamily: fontFamilies.body, fontSize: fontSize.base, color: colors.textMuted },
  sheetFootnote: { margin: space.md, fontFamily: fontFamilies.body, fontSize: fontSize.xs, color: colors.textSubtle, textAlign: "center" },
});
