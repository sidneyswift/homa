import { Text } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AiConsentGate } from "../../src/components/ai-consent-gate";
import RevealScreen from "../../src/app/(onboarding)/reveal";
import YouScreen from "../../src/app/(onboarding)/you";
import { getMyConsentStatus, recordAiProcessingConsent } from "../../src/lib/family";
import { prepareMaterialPrintFromApp, runPreparedMaterialPrint } from "../../src/features/materials/material-print";

const mockReplace = jest.fn();
const mockSaveBasics = jest.fn(async (_input: unknown) => true);
const mockSession = { user: { app_metadata: { provider: "apple" }, user_metadata: { full_name: "Alex Parent" } } };
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }) }));
jest.mock("../../src/features/auth/session-provider", () => ({ useSession: () => ({ session: mockSession }) }));
jest.mock("../../src/features/family/use-family-data", () => ({ useFamilyData: () => ({ family: { id: "family-fixture" }, memberDisplayName: null }) }));
jest.mock("../../src/features/onboarding/basics", () => ({ saveWalkBasics: (input: unknown) => mockSaveBasics(input) }));
jest.mock("../../src/features/onboarding/walk-character", () => ({ useWalkCharacterState: () => {}, useWalkSky: () => {} }));
jest.mock("../../src/features/onboarding/walk-scene", () => ({ WalkScene: ({ children }: { children: unknown }) => children }));
jest.mock("../../src/features/onboarding/onboarding-state", () => ({
  reportOnboardingStep: jest.fn(), saveOnboardingStep: jest.fn(async () => {}),
  loadOnboardingAnswers: jest.fn(async () => ({ kids: [{ childId: "child-fixture", name: "Maya", love: [], workingOn: [] }] })),
}));
jest.mock("../../src/features/onboarding/making", () => ({ startFirstMaking: jest.fn() }));
jest.mock("../../src/lib/materials", () => ({
  getFinalMaterials: jest.fn(async () => [{ id: "material-fixture", childId: "child-fixture", createdAt: "2026-10-05", title: "Maya's page" }]),
  getInProgressMaterials: jest.fn(async () => []),
}));
jest.mock("../../src/features/materials/material-print", () => ({ prepareMaterialPrintFromApp: jest.fn(), runPreparedMaterialPrint: jest.fn() }));
jest.mock("../../src/lib/events", () => ({ emitFamilyEvent: jest.fn() }));
jest.mock("../../src/lib/haptics", () => ({ hapticSuccess: jest.fn(), hapticAdvance: jest.fn() }));
jest.mock("../../src/lib/family", () => ({ getMyConsentStatus: jest.fn(), recordAiProcessingConsent: jest.fn() }));
jest.mock("../../src/lib/web-links", () => ({ openPrivacyPolicy: jest.fn() }));
jest.mock("../../src/features/bootstrap/bootstrap-events", () => ({ reportBootstrapEvent: jest.fn() }));
jest.mock("../../src/features/bootstrap/mobile-bootstrap", () => ({
  runMobileBootstrapStep: async (_step: string, action: () => Promise<unknown>) => {
    try { return { ok: true, value: await action() }; }
    catch { return { ok: false, reason: "offline" }; }
  },
}));

beforeEach(() => {
  jest.mocked(getMyConsentStatus).mockResolvedValue(false);
  jest.mocked(recordAiProcessingConsent).mockResolvedValue(undefined);
});

test("onboarding stays unmounted until affirmative consent is durably saved", async () => {
  const view = await render(<AiConsentGate purpose="onboarding"><Text>Child questions</Text></AiConsentGate>);
  await waitFor(() => expect(view.getByRole("button", { name: "I agree, keep going" })).toBeTruthy());
  expect(view.queryByText("Child questions")).toBeNull();
  jest.mocked(recordAiProcessingConsent).mockRejectedValueOnce(new Error("offline"));
  await fireEvent.press(view.getByRole("button", { name: "I agree, keep going" }));
  await waitFor(() => expect(view.getByText("That didn't go through. You can try again when you're ready.")).toBeTruthy());
  expect(view.queryByText("Child questions")).toBeNull();
  await fireEvent.press(view.getByRole("button", { name: "I agree, keep going" }));
  await waitFor(() => expect(view.getByText("Child questions")).toBeTruthy());
});

test("Apple sign-in reuses the supplied name without asking for it again", async () => {
  const view = await render(<YouScreen />);
  expect(view.queryByText("What should I call you?")).toBeNull();
  await fireEvent.press(view.getByTestId("you.continue"));
  await waitFor(() => expect(mockSaveBasics).toHaveBeenCalledWith({ callMeName: "Alex Parent", usState: undefined }));
  expect(mockReplace).toHaveBeenCalledWith("/making");
});

test("a rejected print preparation restores controls and never prevents continuing", async () => {
  jest.mocked(prepareMaterialPrintFromApp).mockRejectedValue(new Error("offline"));
  const view = await render(<RevealScreen />);
  await waitFor(() => expect(view.getByTestId("reveal.print")).toBeTruthy());
  await fireEvent.press(view.getByTestId("reveal.print"));
  await waitFor(() => expect(view.getByText("Printing didn't open. Your page is saved; you can keep going.")).toBeTruthy());
  expect(view.getByTestId("reveal.print")).toBeEnabled();
  await fireEvent.press(view.getByTestId("reveal.footnoteContinue"));
  expect(mockReplace).toHaveBeenCalledWith("/paywall");
});

test("a cancelled print sheet restores controls and never prevents continuing", async () => {
  jest.mocked(prepareMaterialPrintFromApp).mockResolvedValue({
    materialId: "material-fixture", copies: 1, pageIndexes: [0], answerKeyExcluded: true,
  } as never);
  jest.mocked(runPreparedMaterialPrint).mockResolvedValue({ status: "canceled", message: "Printing canceled." } as never);
  const view = await render(<RevealScreen />);
  await waitFor(() => expect(view.getByTestId("reveal.print")).toBeTruthy());
  await fireEvent.press(view.getByTestId("reveal.print"));
  await waitFor(() => expect(view.getByText("Printing canceled.")).toBeTruthy());
  expect(view.getByTestId("reveal.print")).toBeEnabled();
  await fireEvent.press(view.getByTestId("reveal.footnoteContinue"));
  expect(mockReplace).toHaveBeenCalledWith("/paywall");
});

/** True when a host element sits inside a native scroll view. */
function insideScrollView(element: { type: unknown; parent: unknown } | null): boolean {
  let node = element?.parent as { type: unknown; parent: unknown } | null;
  while (node) {
    if (node.type === "RCTScrollView") return true;
    node = node.parent as { type: unknown; parent: unknown } | null;
  }
  return false;
}

test("print and the footnote sit outside the scrolling page, so neither falls below the fold", async () => {
  const view = await render(<RevealScreen />);
  await waitFor(() => expect(view.getByTestId("reveal.print")).toBeTruthy());
  // The page scrolls (Apple 2.1, iPad compatibility window)...
  expect(insideScrollView(view.getByTestId("reveal.heading"))).toBe(true);
  // ...while the hero action stays pinned above the home bar on a phone
  // (founder catch 2026-11-06: Print it hid under the home indicator).
  expect(insideScrollView(view.getByTestId("reveal.print"))).toBe(false);
  expect(insideScrollView(view.getByTestId("reveal.footnoteContinue"))).toBe(false);
});
