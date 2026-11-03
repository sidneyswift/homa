import { useRef } from "react";
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  View,
  type View as ViewType,
} from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useReducedMotion } from "react-native-reanimated";

import { AccessibleModal } from "../../src/components/ui/accessible-modal";
import { Button } from "../../src/components/ui/button";
import { IconButton } from "../../src/components/ui/icon-button";
import { LoadingStatus } from "../../src/components/ui/loading-status";
import { NativeEyebrow, NativeHeading, NativeText } from "../../src/components/ui/semantic";
import { TextField } from "../../src/components/ui/text-field";
import {
  useAccessibilityAnnouncement,
  useAccessibilityFocusOnChange,
} from "../../src/lib/accessibility";
import { darkQuietColors, quietTypeRoles } from "../../src/theme/tokens";
// The primitives speak App 2's type (DM Sans display), gh#1236.
import { fontFamilies } from "../../src/theme/app2";

const mockedUseReducedMotion = jest.mocked(useReducedMotion);
const mockWindowDimensions = jest.fn();

jest.mock(
  "react-native/Libraries/Utilities/useWindowDimensions",
  () => ({
    __esModule: true,
    default: () => mockWindowDimensions(),
  }),
);

function AnnouncementProbe({
  message,
  occurrenceId,
}: {
  message: string | null;
  occurrenceId?: string;
}) {
  useAccessibilityAnnouncement(message, occurrenceId);
  return null;
}

function ModalProbe({ onClose }: { onClose: () => void }) {
  const headingRef = useRef<ViewType>(null);
  return (
    <AccessibleModal
      initialFocusRef={headingRef}
      onRequestClose={onClose}
      title="Edit task"
      visible
    >
      <View ref={headingRef} accessible accessibilityRole="header">
        <Text>Edit task</Text>
      </View>
    </AccessibleModal>
  );
}

function FocusProbe({ changeKey }: { changeKey: string }) {
  const targetRef = useRef<ViewType>(null);
  useAccessibilityFocusOnChange(targetRef, changeKey);
  return <View ref={targetRef} accessible accessibilityLabel="New question" />;
}

describe("Homa mobile accessibility primitives", () => {
  beforeEach(() => {
    mockedUseReducedMotion.mockReturnValue(false);
    mockWindowDimensions.mockReturnValue({
      fontScale: 1,
      width: 390,
      height: 844,
      scale: 3,
    });
    jest
      .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
    jest
      .spyOn(AccessibilityInfo, "sendAccessibilityEvent")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders a busy button as one disabled, named action", async () => {
    const onPress = jest.fn();
    const view = await render(
      <Button
        label="Create plan"
        accessibilityHint="Creates a draft plan for review."
        busy
        onPress={onPress}
      />,
    );

    const action = view.getByRole("button", { name: "Create plan" });
    expect(action).toBeDisabled();
    expect(action).toBeBusy();
    expect(action).toHaveProp(
      "accessibilityHint",
      "Creates a draft plan for review.",
    );
    expect(action).toHaveStyle({ minHeight: 48 });

    await fireEvent.press(action);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("removes press-scale motion when Reduce Motion is enabled", async () => {
    mockedUseReducedMotion.mockReturnValue(true);
    const view = await render(
      <Button label="Open lesson" onPress={jest.fn()} />,
    );

    const action = view.getByRole("button", { name: "Open lesson" });
    expect(StyleSheet.flatten(action.props.style).transform).toBeUndefined();
  });

  it("preserves compact and large Button geometry through NativeAction", async () => {
    const longLabel = "Prepare a different fractions review for tomorrow morning";
    const view = await render(
      <View>
        <Button label="Keep this one" size="sm" onPress={jest.fn()} />
        <Button label="Delete account" size="lg" variant="ghost" tone="dark" onPress={jest.fn()} />
        <Button label={longLabel} icon={<View testID="button-icon" />} onPress={jest.fn()} />
      </View>,
    );

    expect(view.getByRole("button", { name: "Keep this one" })).toHaveStyle({
      minHeight: 44,
      paddingHorizontal: 16,
      paddingVertical: 8,
    });
    expect(view.getByText("Keep this one")).toHaveStyle({
      fontSize: quietTypeRoles.control.minimumSize,
      lineHeight: quietTypeRoles.control.lineHeight,
    });
    expect(view.getByRole("button", { name: "Delete account" })).toHaveStyle({
      minHeight: 52,
      paddingHorizontal: 24,
      paddingVertical: 14,
    });
    expect(view.getByText("Delete account")).toHaveStyle({ color: darkQuietColors.brandText });
    expect(view.getByTestId("button-icon")).toBeTruthy();
    expect(view.getByText(longLabel).parent).toHaveStyle({
      justifyContent: "center",
      maxWidth: "100%",
    });
    expect(view.getByText(longLabel)).toHaveStyle({
      flexShrink: 1,
      fontSize: quietTypeRoles.control.size,
      lineHeight: quietTypeRoles.control.lineHeight,
      textAlign: "center",
    });
  });

  it("renders semantic text with the approved Quiet authority role metrics", async () => {
    const view = await render(
      <View>
        <NativeHeading level={1}>Your week</NativeHeading>
        <NativeHeading level={2}>This week</NativeHeading>
        <NativeHeading level={3}>Daily plan</NativeHeading>
        <NativeEyebrow>Today</NativeEyebrow>
        <NativeText role="body">Body copy</NativeText>
        <NativeText role="bodyLarge">Large body copy</NativeText>
        <NativeText role="bodySmall">Small body copy</NativeText>
        <NativeText role="caption">Updated at 8:42 AM</NativeText>
        <NativeText role="label">Ready to print</NativeText>
        <NativeText role="metric">12.5 hours</NativeText>
      </View>,
    );

    expect(view.getByText("Your week")).toHaveStyle({
      fontFamily: fontFamilies.displaySemibold,
      fontSize: 36,
      lineHeight: 40,
    });
    expect(view.getByText("This week")).toHaveStyle({
      fontFamily: fontFamilies.displaySemibold,
      fontSize: 28,
      lineHeight: 32,
    });
    expect(view.getByText("Daily plan")).toHaveStyle({
      fontFamily: fontFamilies.displaySemibold,
      fontSize: 22,
      lineHeight: 28,
    });
    expect(view.getByText("Today")).toHaveStyle({
      fontFamily: fontFamilies.bodyBold,
      fontSize: quietTypeRoles.eyebrow.size,
      lineHeight: quietTypeRoles.eyebrow.lineHeight,
      letterSpacing: quietTypeRoles.eyebrow.size * 0.08,
      textTransform: "uppercase",
    });
    expect(view.getByText("Body copy")).toHaveStyle({
      fontFamily: fontFamilies.body,
      fontSize: quietTypeRoles.body.size,
      lineHeight: quietTypeRoles.body.lineHeight,
    });
    expect(view.getByText("Large body copy")).toHaveStyle({
      fontFamily: fontFamilies.body,
      fontSize: quietTypeRoles.bodyLarge.size,
      lineHeight: quietTypeRoles.bodyLarge.lineHeight,
    });
    expect(view.getByText("Small body copy")).toHaveStyle({
      fontFamily: fontFamilies.body,
      fontSize: quietTypeRoles.bodySmall.size,
      lineHeight: quietTypeRoles.bodySmall.lineHeight,
    });
    expect(view.getByText("Updated at 8:42 AM")).toHaveStyle({
      fontFamily: fontFamilies.bodyMedium,
      fontSize: quietTypeRoles.caption.size,
      lineHeight: quietTypeRoles.caption.lineHeight,
    });
    expect(view.getByText("Ready to print")).toHaveStyle({
      fontFamily: fontFamilies.bodySemibold,
      fontSize: quietTypeRoles.label.size,
      lineHeight: quietTypeRoles.label.lineHeight,
    });
    expect(view.getByText("12.5 hours")).toHaveStyle({
      fontFamily: fontFamilies.bodySemibold,
      fontSize: quietTypeRoles.metric.minSize,
      lineHeight: quietTypeRoles.metric.lineHeight,
      fontVariant: ["tabular-nums"],
    });
  });

  it("uses natural custom-font line metrics at accessibility text sizes", async () => {
    mockWindowDimensions.mockReturnValue({
      fontScale: 2,
      width: 390,
      height: 844,
      scale: 3,
    });
    const view = await render(
      <View>
        <NativeHeading level={1}>Readable heading</NativeHeading>
        <NativeText role="body">Readable body</NativeText>
        <NativeText role="label">Readable label</NativeText>
      </View>,
    );

    expect(view.getByText("Readable heading")).toHaveStyle({ lineHeight: undefined });
    expect(view.getByText("Readable body")).toHaveStyle({ lineHeight: undefined });
    expect(view.getByText("Readable label")).toHaveStyle({ lineHeight: undefined });
    expect(view.getByText("Readable body")).not.toHaveProp("maxFontSizeMultiplier");
  });

  it("preserves caller TextInput accessibility state through the field adapter", async () => {
    const view = await render(
      <TextField
        label="Family email"
        value="parent@example.com"
        accessibilityState={{ busy: true, disabled: true, expanded: true }}
      />,
    );

    expect(view.getByLabelText("Family email")).toHaveProp("accessibilityState", {
      busy: true,
      disabled: true,
      expanded: true,
    });
  });

  it("keeps an icon action named while hiding decorative descendants", async () => {
    const view = await render(
      <IconButton label="Close details" onPress={jest.fn()}>
        <Text accessibilityLabel="Decorative cross">x</Text>
      </IconButton>,
    );

    const action = view.getByRole("button", { name: "Close details" });
    expect(action).toHaveStyle({ minWidth: 44, minHeight: 44 });
    expect(view.queryByLabelText("Decorative cross")).toBeNull();
    expect(view.getAllByRole("button")).toHaveLength(1);
  });

  it("renders and announces one coherent loading status", async () => {
    const view = await render(<LoadingStatus label="Loading Mia's progress" />);

    const status = view.getByRole("progressbar", {
      name: "Loading Mia's progress",
    });
    expect(status).toHaveStyle({ minHeight: 44 });
    expect(view.getByText("Loading Mia's progress")).toBeVisible();
    await waitFor(() => {
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledTimes(1);
      expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
        "Loading Mia's progress",
      );
    });
  });

  it("uses the visible field label as its accessible name and preserves focus state", async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const view = await render(
      <TextField
        label="Child's name"
        placeholder="Mia"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );

    const field = view.getByLabelText("Child's name");
    expect(field).toHaveStyle({ minHeight: 48, borderWidth: 1 });

    await fireEvent(field, "focus", { nativeEvent: {} });
    await waitFor(() => expect(field).toHaveStyle({ borderWidth: 2 }));
    expect(onFocus).toHaveBeenCalledTimes(1);

    await fireEvent(field, "blur", { nativeEvent: {} });
    await waitFor(() => expect(field).toHaveStyle({ borderWidth: 1 }));
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("isolates a modal and exposes the screen-reader Escape action", async () => {
    const onClose = jest.fn();
    const view = await render(<ModalProbe onClose={onClose} />);

    const surface = view.getByLabelText("Edit task");
    expect(surface).toHaveProp("accessibilityViewIsModal", true);
    expect(surface).toHaveProp("importantForAccessibility", "yes");

    await fireEvent(surface, "accessibilityEscape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("requests focus with React Native's supported host event", async () => {
    await render(<FocusProbe changeKey="question-2" />);

    await waitFor(() => {
      expect(AccessibilityInfo.sendAccessibilityEvent).toHaveBeenCalledWith(
        expect.anything(),
        "focus",
      );
    });
  });

  it("deduplicates one occurrence but announces a later identical event", async () => {
    const planSavedCalls = () =>
      jest
        .mocked(AccessibilityInfo.announceForAccessibility)
        .mock.calls.filter(([message]) => message === "Plan saved");
    const view = await render(
      <AnnouncementProbe message="Plan saved" occurrenceId="receipt-1" />,
    );
    await waitFor(() => expect(planSavedCalls()).toHaveLength(1));

    await view.rerender(
      <AnnouncementProbe message="Plan saved" occurrenceId="receipt-1" />,
    );
    expect(planSavedCalls()).toHaveLength(1);

    await view.rerender(
      <AnnouncementProbe message="Plan saved" occurrenceId="receipt-2" />,
    );
    await waitFor(() => expect(planSavedCalls()).toHaveLength(2));
  });

  it("resets an announcement after a quiet state", async () => {
    const receiptCalls = () =>
      jest
        .mocked(AccessibilityInfo.announceForAccessibility)
        .mock.calls.filter(([message]) => message === "Calendar saved");
    const view = await render(
      <AnnouncementProbe message="Calendar saved" occurrenceId="save-1" />,
    );
    await waitFor(() => expect(receiptCalls()).toHaveLength(1));

    await view.rerender(<AnnouncementProbe message={null} />);
    await view.rerender(
      <AnnouncementProbe message="Calendar saved" occurrenceId="save-1" />,
    );
    await waitFor(() => expect(receiptCalls()).toHaveLength(2));
  });

  it("stays silent when a screen reader is not running", async () => {
    jest
      .mocked(AccessibilityInfo.isScreenReaderEnabled)
      .mockResolvedValue(false);
    await render(<AnnouncementProbe message="Plan saved" />);

    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith(
      "Plan saved",
    );
  });
});
