import { fireEvent, render } from "@testing-library/react-native";
import { activityPlanSchema } from "@homa/core";
import { ActivityPlanCard } from "../../src/features/materials/activity-plan-card";

const mockPrepareQuestion = jest.fn();
jest.mock("../../src/features/workspace/context", () => ({ useNativeWorkspace: () => ({ prepareQuestion: mockPrepareQuestion }) }));
const plan = activityPlanSchema.parse({ version: 1, minutes: 20, introduction: "Count together", swapped: [], activities: [1, 2].map(n => ({ id: `step-${n}`, title: `Count ${n}`, minutes: 10, instructions: "Count five buttons", materials: ["Buttons"], alternative: { title: `Walk ${n}`, instructions: "Take five steps" } })) });

test("native plan edits remain local until the parent prepares a save question", async () => {
  const screen = await render(<ActivityPlanCard id="saved-plan" title="Our plan" childName="Maya" plan={plan} />);
  await fireEvent.press(screen.getByRole("button", { name: "5 minutes more" }));
  await fireEvent.press(screen.getAllByRole("button", { name: "Try another idea" })[0]);
  expect(screen.getByText("25 minutes")).toBeTruthy();
  expect(screen.getByText("Walk 1 · 13 min")).toBeTruthy();
  expect(mockPrepareQuestion).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Ask Homa to save changes" }));
  expect(mockPrepareQuestion).toHaveBeenCalledWith(expect.stringContaining("25 minutes"));
  expect(mockPrepareQuestion).toHaveBeenCalledWith(expect.stringContaining("Selected alternatives: step-1"));
  await fireEvent.press(screen.getByRole("button", { name: "Reset changes" }));
  expect(screen.getByText("20 minutes")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Ask Homa to save changes" })).toBeNull();
});

test("saved choices reopen and simplifying carries those choices", async () => {
  const screen = await render(<ActivityPlanCard id="saved-plan" title="Our plan" childName={null} plan={{ ...plan, minutes: 30, swapped: ["step-2"] }} />);
  expect(screen.getByText("Walk 2 · 15 min")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Make it simpler" }));
  expect(mockPrepareQuestion).toHaveBeenCalledWith(expect.stringContaining("30 minutes; selected alternatives: step-2"));
});
