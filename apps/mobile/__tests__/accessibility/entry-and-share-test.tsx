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
  };
});

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

describe("native entry and recovery accessibility", () => {
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
    jest
      .spyOn(AccessibilityInfo, "isScreenReaderEnabled")
      .mockResolvedValue(true);
    jest
      .spyOn(AccessibilityInfo, "announceForAccessibility")
      .mockImplementation(() => undefined);
  });

  it("keeps every entry action named and recovers from an empty submit", async () => {
    const view = await render(<SignInScreen />);

    const entryActions = view.getAllByRole("button");
    expect(entryActions[0]).toHaveAccessibleName("Continue with Apple");
    expect(entryActions[1]).toHaveAccessibleName("Continue with Google");

    expect(view.getByLabelText("Email")).toHaveStyle({ minHeight: 48 });
    expect(view.getByLabelText("Password")).toHaveProp(
      "secureTextEntry",
      true,
    );
    expect(
      view.getByRole("button", { name: "Continue with Apple" }),
    ).toHaveStyle({ height: 52 });
    expect(
      view.getByRole("button", { name: "Continue with Google" }),
    ).toHaveStyle({ minHeight: 52 });

    await fireEvent.press(view.getByRole("button", { name: "Sign in" }));
    expect(
      await view.findByLabelText(
        "Error. Email and password are both needed.",
      ),
    ).toBeVisible();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();

    await fireEvent.press(
      view.getByRole("button", { name: "Create an account on the web" }),
    );
    expect(mockOpenWebOnboarding).toHaveBeenCalledTimes(1);
  });

  it("normalizes recovery email and announces the privacy-safe receipt", async () => {
    const view = await render(<SignInScreen />);
    await fireEvent.changeText(
      view.getByLabelText("Email"),
      "  MOM@EXAMPLE.COM  ",
    );
    await fireEvent.press(
      view.getByRole("button", { name: "Send reset link" }),
    );

    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        "mom@example.com",
        { redirectTo: "https://thankshoma.com/reset-password/confirm" },
      );
    });
    const receipt =
      "If that email is connected to Homa, a reset link is on its way. It may take a minute.";
    expect(await view.findByText(receipt)).toBeVisible();
    await waitFor(() => {
      expect(
        jest
          .mocked(AccessibilityInfo.announceForAccessibility)
          .mock.calls.filter(([message]) => message === receipt),
      ).toHaveLength(1);
    });
  });

  it("exposes sign-in work as busy while preventing duplicate actions", async () => {
    let settleSignIn: ((value: { error: null }) => void) | undefined;
    mockSignInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        settleSignIn = resolve;
      }),
    );
    const view = await render(<SignInScreen />);
    await fireEvent.changeText(view.getByLabelText("Email"), "mom@example.com");
    await fireEvent.changeText(view.getByLabelText("Password"), "correct horse");
    await fireEvent.press(view.getByRole("button", { name: "Sign in" }));

    const pending = view.getByRole("button", { name: "One moment…" });
    expect(pending).toBeDisabled();
    expect(pending).toBeBusy();
    expect(
      view.getByRole("button", { name: "Continue with Google" }),
    ).toBeDisabled();

    await act(async () => {
      settleSignIn?.({ error: null });
    });
    await waitFor(() =>
      expect(view.getByRole("button", { name: "Sign in" })).toBeEnabled(),
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
