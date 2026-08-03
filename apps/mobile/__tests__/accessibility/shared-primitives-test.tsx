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
import { TextField } from "../../src/components/ui/text-field";
import {
  useAccessibilityAnnouncement,
  useAccessibilityFocusOnChange,
} from "../../src/lib/accessibility";

const mockedUseReducedMotion = jest.mocked(useReducedMotion);

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
