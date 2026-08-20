import { AccessibilityInfo } from "react-native";
import {
  act,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

import SignInScreen from "../../src/app/(auth)/signin";
import { MaterialShareComposer } from "../../src/features/materials/material-share-composer";
import type { PreparedMaterialShareRequest } from "../../src/features/materials/material-share-contract";

const mockUseSession = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockResetPasswordForEmail = jest.fn();
const mockSignInWithGoogle = jest.fn();
const mockSignInWithApple = jest.fn();
const mockOpenWebOnboarding = jest.fn();
const mockRunPreparedMaterialShare = jest.fn();
const mockEmitFamilyEvent = jest.fn();

jest.mock("expo-router", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement(View, {
        accessible: true,
        accessibilityLabel: `Redirect to ${href}`,
      }),
    // The entry screen routes to the email door, so the mock has to carry
    // useRouter or the whole screen throws before a single assertion runs.
    // push is hoisted so a test can assert where the door leads.
    useRouter: () => ({
      push: mockRouterPush,
      back: jest.fn(),
      replace: jest.fn(),
    }),
  };
});

const mockRouterPush = jest.fn();

jest.mock("expo-apple-authentication", () => {
  const React = jest.requireActual("react");
  const { Pressable } = jest.requireActual("react-native");
  return {
    AppleAuthenticationButtonType: { SIGN_IN: "sign-in" },
    AppleAuthenticationButtonStyle: { BLACK: "black" },
    AppleAuthenticationButton: ({
      accessibilityLabel,
      accessibilityState,
      onPress,
      style,
    }: {
      accessibilityLabel: string;
      accessibilityState: { disabled?: boolean; busy?: boolean };
      onPress: () => void;
      style: object;
    }) =>
      React.createElement(Pressable, {
        accessibilityRole: "button",
        accessibilityLabel,
        accessibilityState,
        disabled: accessibilityState.disabled,
        onPress,
        style,
      }),
  };
});

jest.mock("../../src/features/auth/session-provider", () => ({
  useSession: () => mockUseSession(),
}));

jest.mock("../../src/features/auth/google-sign-in", () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
}));

jest.mock("../../src/features/auth/apple-sign-in", () => ({
  signInWithApple: () => mockSignInWithApple(),
}));

jest.mock("../../src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) =>
        mockSignInWithPassword(...args),
      resetPasswordForEmail: (...args: unknown[]) =>
        mockResetPasswordForEmail(...args),
    },
  },
}));

jest.mock("../../src/lib/web-links", () => ({
  openWebOnboarding: () => mockOpenWebOnboarding(),
}));

jest.mock("../../src/features/materials/material-share", () => ({
  runPreparedMaterialShare: (...args: unknown[]) =>
    mockRunPreparedMaterialShare(...args),
}));

jest.mock("../../src/lib/events", () => ({
  emitFamilyEvent: (...args: unknown[]) => mockEmitFamilyEvent(...args),
}));

const shareRequest: PreparedMaterialShareRequest = {
  materialId: "55555555-5555-4555-8555-555555555555",
  title: "Mia's reading cards",
  authorizedPdfPath:
    "/api/materials/55555555-5555-4555-8555-555555555555/pdf",
  suggestedMessage: "Here are Mia's reading cards.",
};

describe("native entry accessibility", () => {
  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = "https://thankshoma.com";
    mockUseSession.mockReturnValue({
      session: null,
      initializing: false,
      failureReason: null,
      retry: jest.fn(),
      continueSignedOut: jest.fn(),
    });
    mockSignInWithPassword.mockReset();
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockResetPasswordForEmail.mockReset();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    mockSignInWithGoogle.mockReset();
    mockSignInWithGoogle.mockResolvedValue({ status: "dismissed" });
    mockSignInWithApple.mockReset();
    mockSignInWithApple.mockResolvedValue({ status: "dismissed" });
    mockOpenWebOnboarding.mockReset();
    mockOpenWebOnboarding.mockResolvedValue(undefined);
    mockRouterPush.mockReset();
    jest
      .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
  });

  it("names three doors and offers nothing else to get wrong", async () => {
    const view = await render(<SignInScreen />);

    const entryActions = view.getAllByRole("button");
    expect(entryActions[0]).toHaveAccessibleName("Continue with Apple");
    expect(entryActions[1]).toHaveAccessibleName("Continue with Google");
    expect(entryActions[2]).toHaveAccessibleName("Continue with email");

    // One silhouette. Apple's component takes an exact height, ours a floor.
    expect(
      view.getByRole("button", { name: "Continue with Apple" }),
    ).toHaveStyle({ height: 52 });
    for (const name of ["Continue with Google", "Continue with email"]) {
      expect(view.getByRole("button", { name })).toHaveStyle({ minHeight: 52 });
    }

    // Founder ruling 2026-08-18: no password anywhere in this app, so no
    // credential fields and no recovery action for a parent to find.
    expect(view.queryByLabelText("Email")).toBeNull();
    expect(view.queryByLabelText("Password")).toBeNull();
    expect(view.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(view.queryByRole("button", { name: "Send reset link" })).toBeNull();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();

    // No route out to the web. Setup finishes in the app.
    expect(view.queryByRole("button", { name: "Open onboarding" })).toBeNull();
    expect(mockOpenWebOnboarding).not.toHaveBeenCalled();
  });

  it("tells a stranger this screen is for them too, and links both documents", async () => {
    const view = await render(<SignInScreen />);

    // Every critic in the design loop asked for this line independently: a
    // door list says nothing about whether a new parent belongs here.
    expect(
      view.getByText("New here or coming back, any of these gets you in."),
    ).toBeVisible();

    for (const name of ["Terms of use", "Privacy policy"]) {
      expect(view.getByRole("link", { name })).toBeVisible();
    }
  });

  it("routes the email door to its own step", async () => {
    const view = await render(<SignInScreen />);
    await fireEvent.press(
      view.getByRole("button", { name: "Continue with email" }),
    );
    expect(mockRouterPush).toHaveBeenCalledWith("/email");
  });

  it("exposes provider work as busy while preventing duplicate actions", async () => {
    let settleGoogle: ((value: { status: string }) => void) | undefined;
    mockSignInWithGoogle.mockReturnValue(
      new Promise((resolve) => {
        settleGoogle = resolve;
      }),
    );
    const view = await render(<SignInScreen />);
    await fireEvent.press(
      view.getByRole("button", { name: "Continue with Google" }),
    );

    const pending = view.getByRole("button", { name: "Opening Google…" });
    expect(pending).toBeDisabled();
    expect(pending).toBeBusy();
    // One door open at a time, including the email door, which navigates
    // rather than authenticates and would otherwise leave a live attempt behind.
    expect(
      view.getByRole("button", { name: "Continue with email" }),
    ).toBeDisabled();

    await act(async () => {
      settleGoogle?.({ status: "dismissed" });
    });
    await waitFor(() =>
      expect(
        view.getByRole("button", { name: "Continue with Google" }),
      ).toBeEnabled(),
    );
  });
});

describe("truthful native share accessibility", () => {
  beforeEach(() => {
    mockRunPreparedMaterialShare.mockReset();
    mockEmitFamilyEvent.mockReset();
    mockEmitFamilyEvent.mockResolvedValue(undefined);
    jest
      .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
  });

  it("passes the edited note and exposes the native handoff as busy", async () => {
    const handedOff = {
      status: "handed-off" as const,
      message:
        "The PDF is in your chosen app. Check that app to finish or confirm sending.",
    };
    let settleShare:
      | ((value: typeof handedOff) => void)
      | undefined;
    mockRunPreparedMaterialShare.mockReturnValue(
      new Promise((resolve) => {
        settleShare = resolve;
      }),
    );
    const onResult = jest.fn();
    const view = await render(
      <MaterialShareComposer
        request={shareRequest}
        familyId="44444444-4444-4444-8444-444444444444"
        onResult={onResult}
      />,
    );
    const note = view.getByLabelText("Optional note for the recipient");
    await fireEvent.changeText(note, "Please print these for Tuesday.");
    await fireEvent.press(view.getByRole("button", { name: "Choose an app" }));

    const opening = view.getByRole("button", { name: "Opening your apps…" });
    expect(opening).toBeDisabled();
    expect(opening).toBeBusy();
    expect(mockRunPreparedMaterialShare).toHaveBeenCalledWith(
      shareRequest,
      "Please print these for Tuesday.",
    );

    await act(async () => {
      settleShare?.(handedOff);
    });
    expect(await view.findByText(handedOff.message)).toBeVisible();
    await waitFor(() => {
      expect(
        jest
          .mocked(AccessibilityInfo.announceForAccessibility)
          .mock.calls.filter(([message]) => message === handedOff.message),
      ).toHaveLength(1);
    });
    expect(onResult).toHaveBeenCalledWith(handedOff);
    expect(mockEmitFamilyEvent).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      "materials.share_result",
      {
        material_id: shareRequest.materialId,
        outcome: "handed_off",
      },
    );
  });

  it.each([
    {
      result: {
        status: "canceled" as const,
        message: "Sharing canceled. Nothing was handed off.",
      },
      event: {
        material_id: shareRequest.materialId,
        outcome: "canceled",
      },
    },
    {
      result: {
        status: "failed" as const,
        reason: "offline" as const,
        message:
          "You're offline. The printable is still safe in your Binder, so try again when you're connected.",
      },
      event: {
        material_id: shareRequest.materialId,
        outcome: "failed",
        reason: "offline",
      },
    },
  ])("renders and announces the $result.status outcome once", async ({ result, event }) => {
    mockRunPreparedMaterialShare.mockResolvedValue(result);
    const view = await render(
      <MaterialShareComposer
        request={shareRequest}
        familyId="44444444-4444-4444-8444-444444444444"
        onResult={jest.fn()}
      />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Choose an app" }));

    expect(await view.findByText(result.message)).toBeVisible();
    await waitFor(() => {
      expect(
        jest
          .mocked(AccessibilityInfo.announceForAccessibility)
          .mock.calls.filter(([message]) => message === result.message),
      ).toHaveLength(1);
    });
    expect(mockEmitFamilyEvent).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      "materials.share_result",
      event,
    );
  });

  it("does not emit family telemetry without a ready family", async () => {
    mockRunPreparedMaterialShare.mockResolvedValue({
      status: "canceled",
      message: "Sharing canceled. Nothing was handed off.",
    });
    const view = await render(
      <MaterialShareComposer request={shareRequest} />,
    );
    await fireEvent.press(view.getByRole("button", { name: "Choose an app" }));

    expect(
      await view.findByText("Sharing canceled. Nothing was handed off."),
    ).toBeVisible();
    expect(mockEmitFamilyEvent).not.toHaveBeenCalled();
  });
});
