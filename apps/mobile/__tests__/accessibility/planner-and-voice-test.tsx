import { AccessibilityInfo } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

import { MonthView } from "../../src/features/planner/month-view";
import type { ScheduledActivityView } from "../../src/features/planner/planner-model";
import { VoiceDock } from "../../src/features/voice/voice-dock";
import type { VoiceSession } from "../../src/features/voice/use-voice-session";
import type { FamilyEventRecord } from "../../src/lib/family-events";

const mockWindowDimensions = jest.fn();
const mockNavigate = jest.fn();
const mockUsePathname = jest.fn();
const mockUseVoiceWorkbench = jest.fn();

jest.mock(
  "react-native/Libraries/Utilities/useWindowDimensions",
  () => ({
    __esModule: true,
    default: () => mockWindowDimensions(),
  }),
);

jest.mock("expo-router", () => ({
  usePathname: () => mockUsePathname(),
  useRouter: () => ({ navigate: mockNavigate }),
}));

jest.mock("../../src/features/voice/voice-workbench-provider", () => ({
  useVoiceWorkbench: () => mockUseVoiceWorkbench(),
}));

jest.mock("../../src/features/voice/homa-character", () => ({
  HomaCharacter: () => null,
}));

const plannerEvent: FamilyEventRecord = {
  id: "66666666-6666-4666-8666-666666666666",
  family_id: "44444444-4444-4444-8444-444444444444",
  child_id: "11111111-1111-4111-8111-111111111111",
  title: "Library visit",
  starts_on: "2026-08-04",
  ends_on: "2026-08-04",
  start_time: "10:00",
  end_time: null,
  note: null,
  created_at: "2026-08-02T14:00:00-04:00",
};

const plannerActivity: ScheduledActivityView = {
  scheduleId: "77777777-7777-4777-8777-777777777777",
  scheduledDate: "2026-08-04",
  childId: "11111111-1111-4111-8111-111111111111",
  childIndex: 0,
  childName: "Mia",
  subjectId: "reading",
  subjectName: "Reading",
  week: 1,
  activityIndex: 0,
  text: "Read one short story together.",
  done: false,
  sources: [],
};

function voiceSession(
  overrides: Partial<VoiceSession>,
): VoiceSession {
  return {
    messages: [],
    status: "listening",
    assistantAudioLevel: null,
    turnActive: true,
    muted: false,
    pauseReason: null,
    assistantTextStreaming: false,
    busyDetail: null,
    lastUserText: null,
    lastAssistantText: null,
    failed: false,
    recovering: false,
    speaking: false,
    handoffReady: true,
    start: jest.fn(),
    end: jest.fn(),
    retry: jest.fn(),
    sendText: jest.fn(() => true),
    announceResult: jest.fn(),
    toggleMute: jest.fn(),
    pauseForMicrophoneOwner: jest.fn(),
    resume: jest.fn(),
    ...overrides,
  };
}

describe("large-text Planner accessibility", () => {
  beforeEach(() => {
    mockWindowDimensions.mockReturnValue({
      fontScale: 2,
      width: 320,
      height: 640,
      scale: 3,
    });
  });

  it("replaces the dense grid with named 56-point day actions", async () => {
    const onSelectDate = jest.fn();
    const view = await render(
      <MonthView
        anchorDate="2026-08-15"
        events={[plannerEvent]}
        activities={[plannerActivity]}
        onSelectDate={onSelectDate}
      />,
    );

    expect(view.queryByLabelText("Month calendar")).toBeNull();
    expect(view.getAllByRole("button")).toHaveLength(31);
    const day = view.getByRole("button", {
      name: "Tuesday, Aug 4, 2026. 1 event · 1 activity",
    });
    expect(view.getByText("Tuesday, Aug 4, 2026")).toBeVisible();
    expect(view.getByText("1 event · 1 activity")).toBeVisible();
    expect(day).toHaveStyle({ minHeight: 56 });
    expect(day).toHaveProp("accessibilityHint", "Shows this day in Planner");
    await fireEvent.press(day);
    expect(onSelectDate).toHaveBeenCalledWith("2026-08-04");
  });
});

describe("persistent Voice controls accessibility", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUsePathname.mockReset();
    mockUsePathname.mockReturnValue("/planner");
    mockUseVoiceWorkbench.mockReset();
    mockWindowDimensions.mockReturnValue({
      fontScale: 2,
      width: 320,
      height: 640,
      scale: 3,
    });
    jest.mocked(useSafeAreaInsets).mockReturnValue({
      top: 0,
      right: 0,
      bottom: 34,
      left: 0,
    });
    jest
      .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
  });

  it.each([
    {
      status: "listening" as const,
      visible: "Listening",
      spoken: "Homa is listening.",
      primary: "Mute",
    },
    {
      status: "working" as const,
      visible: "Homa is working",
      spoken: "Homa is working. Building your plan.",
      primary: "Mute",
      busyDetail: "Building your plan.",
    },
    {
      status: "speaking" as const,
      visible: "Homa is speaking",
      spoken: "Homa is speaking.",
      primary: "Mute",
    },
  ])(
    "keeps the $status state visible, spoken, and expandable",
    async ({ status, visible, spoken, primary, busyDetail = null }) => {
      const session = voiceSession({ status, busyDetail });
      mockUseVoiceWorkbench.mockReturnValue({ session });
      const view = await render(<VoiceDock />);

      const compact = view.getByRole("button", {
        name: `Homa Voice. ${visible}. Show controls`,
      });
      await waitFor(() => {
        expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
          spoken,
        );
      });
      await fireEvent.press(compact);

      expect(
        view.getByRole("button", { name: `${visible}. ${primary}` }),
      ).toHaveStyle({ minHeight: 44 });
      expect(
        view.getByRole("button", { name: "Return to Homa Voice" }),
      ).toHaveStyle({ width: 44, height: 44 });
      expect(
        view.getByRole("button", { name: "End voice conversation" }),
      ).toHaveStyle({ width: 44, height: 44 });
    },
  );

  it.each([
    {
      label: "connecting",
      session: { status: "connecting" as const },
      visible: "Getting Homa ready",
      spoken: "Getting Homa ready.",
      primary: "Cancel voice connection",
      action: "end" as const,
    },
    {
      label: "paused",
      session: {
        status: "paused" as const,
        pauseReason: "Lesson recording has the microphone",
      },
      visible: "Lesson recording has the microphone",
      spoken: "Lesson recording has the microphone",
      primary: "Resume",
      action: "resume" as const,
    },
    {
      label: "muted",
      session: { status: "listening" as const, muted: true },
      visible: "Muted",
      spoken: "Homa Voice is muted.",
      primary: "Unmute",
      action: "toggleMute" as const,
    },
    {
      label: "interrupted",
      session: {
        status: "failed" as const,
        failed: true,
        busyDetail: "Connection dropped.",
      },
      visible: "Voice was interrupted",
      spoken: "Voice was interrupted. Connection dropped.",
      primary: "Try again",
      action: "retry" as const,
    },
  ])(
    "keeps the $label recovery action explicit",
    async ({ session: sessionOverrides, visible, spoken, primary, action }) => {
      const session = voiceSession(sessionOverrides);
      mockUseVoiceWorkbench.mockReturnValue({ session });
      const view = await render(<VoiceDock />);

      const primaryAction = view.getByRole("button", {
        name: `${visible}. ${primary}`,
      });
      await waitFor(() => {
        expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
          spoken,
        );
      });
      await fireEvent.press(primaryAction);
      expect(session[action]).toHaveBeenCalledTimes(1);
    },
  );

  it("stays out of the accessibility tree when no Voice session is active", async () => {
    mockUseVoiceWorkbench.mockReturnValue({
      session: voiceSession({ status: "idle", turnActive: false }),
    });
    const view = await render(<VoiceDock />);

    expect(view.queryAllByRole("button")).toHaveLength(0);
    expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalled();
  });

  it("stays hidden on the full Voice route during an active session", async () => {
    mockUsePathname.mockReturnValue("/voice");
    mockUseVoiceWorkbench.mockReturnValue({
      session: voiceSession({ status: "listening" }),
    });
    const view = await render(<VoiceDock />);

    expect(view.queryAllByRole("button")).toHaveLength(0);
  });

  it("forgets manual expansion after the mom leaves and returns", async () => {
    mockUseVoiceWorkbench.mockReturnValue({
      session: voiceSession({ status: "listening" }),
    });
    const view = await render(<VoiceDock />);
    await fireEvent.press(
      view.getByRole("button", {
        name: "Homa Voice. Listening. Show controls",
      }),
    );
    expect(
      view.getByRole("button", { name: "Listening. Mute" }),
    ).toBeVisible();

    mockUsePathname.mockReturnValue("/binder");
    await view.rerender(<VoiceDock />);
    mockUsePathname.mockReturnValue("/planner");
    await view.rerender(<VoiceDock />);

    expect(
      view.getByRole("button", {
        name: "Homa Voice. Listening. Show controls",
      }),
    ).toBeVisible();
    expect(
      view.queryByRole("button", { name: "Listening. Mute" }),
    ).toBeNull();
  });
});
