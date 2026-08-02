import assert from "node:assert/strict";
import { describe, it } from "node:test";

import addChild from "../../agent/tools/add_child";
import askForDetailsDynamic from "../../agent/tools/ask_for_details";
import saveFamilyBasics from "../../agent/tools/save_family_basics";
import saveHomeschoolProfile from "../../agent/tools/save_homeschool_profile";

const savedCardAttributes = {
  channel: "web",
  onboardingActive: "true",
  messageSource: "saved_card_answer",
};

const toolContext = {
  channel: { kind: "channel:http", metadata: {} },
  session: { auth: { current: { attributes: savedCardAttributes } } },
};

type ExecutableTool = {
  execute(
    input: unknown,
    context: unknown,
  ): Promise<Record<string, unknown>>;
};

async function execute(
  tool: unknown,
  input: unknown,
): Promise<Record<string, unknown>> {
  return (tool as ExecutableTool).execute(input, toolContext);
}

describe("saved onboarding card provenance", () => {
  it("refuses duplicate setup and child writes before database access", async () => {
    const basics = await execute(saveFamilyBasics, {
      callMeName: "Sidney",
      usState: "DC",
    });
    const profile = await execute(saveHomeschoolProfile, {
      styles: ["eclectic"],
    });
    const child = await execute(addChild, {
      name: "Mia",
      birthDate: "2019-04-12",
    });

    assert.deepEqual(
      [basics.saved, profile.saved, child.added],
      [false, false, false],
    );
    assert.deepEqual(
      [basics.done, profile.done, child.done],
      [true, true, true],
    );
  });

  it("removes the details card tool from the saved-card step", () => {
    const dynamic = askForDetailsDynamic as unknown as {
      events: Record<
        string,
        (event: unknown, context: typeof toolContext) => unknown
      >;
    };

    assert.equal(dynamic.events["step.started"](null, toolContext), null);
  });
});
