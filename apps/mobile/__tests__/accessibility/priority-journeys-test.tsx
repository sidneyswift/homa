import type { ProgressNextMove } from "@homa/core";
import { fireEvent, render } from "@testing-library/react-native";

import { QuestionCard } from "../../src/features/chat/question-card";
import type { QuestionCardData } from "../../src/features/chat/question-card-model";
import { EventCard } from "../../src/features/planner/event-card";
import { ProgressNextMoveCard } from "../../src/features/progress/progress-next-move-card";
import type { FamilyEventRecord } from "../../src/lib/family-events";

const progressMove: Extract<ProgressNextMove, { kind: "move" }> = {
  kind: "move",
  childId: "11111111-1111-4111-8111-111111111111",
  sourceRevision: "7",
  targetItemId: "reading.decode-cvc",
  targetStatement: "Reads short-vowel words with growing confidence",
  minutes: 10,
  activity: "Build three words with letter tiles, then let Mia read each one.",
  why: "This keeps the next step small and connected to what Mia just showed.",
  evidence: [
    {
      evidenceId: "22222222-2222-4222-8222-222222222222",
      itemId: "reading.decode-cvc",
      statement: "Reads short-vowel words with growing confidence",
      answer: "getting_there",
      derivation: "direct",
      sourceKind: "lesson_listen",
      adultDisplayName: "Sidney",
      observedAt: "2026-08-02T14:00:00-04:00",
      receipt: "From Friday's reading lesson",
    },
  ],
  chatDraft: "Adjust this reading idea for Mia and show me the draft first.",
};

const familyEvent: FamilyEventRecord = {
  id: "33333333-3333-4333-8333-333333333333",
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

const oneQuestion: QuestionCardData = {
  questions: [
    {
      header: "Best time",
      question: "When would this feel easiest tomorrow?",
      multiSelect: false,
      options: [
        { label: "After breakfast", description: "Before the day gets busy." },
        { label: "After lunch", description: "Once everyone has reset." },
      ],
    },
  ],
};

describe("Homa priority journey accessibility", () => {
  it("puts progress evidence before an editable next move and never auto-sends", async () => {
    const onOpenChat = jest.fn();
    const onDismiss = jest.fn();
    const view = await render(
      <ProgressNextMoveCard
        nextMove={progressMove}
        onOpenChat={onOpenChat}
        onDismiss={onDismiss}
        dismissing={false}
        dismissError={null}
      />,
    );

    expect(view.getByText("From Friday's reading lesson")).toBeVisible();
    expect(
      view.getByRole("header", { name: "A small idea for today" }),
    ).toBeVisible();
    expect(
      view.getByLabelText(
        "Working on Reads short-vowel words with growing confidence",
      ),
    ).toBeVisible();

    const adjust = view.getByRole("button", { name: "Adjust in Chat" });
    expect(adjust).toHaveProp(
      "accessibilityHint",
      "Opens an editable draft. Nothing sends until you tap Send.",
    );
    await fireEvent.press(adjust);
    expect(onOpenChat).toHaveBeenCalledWith(progressMove.chatDraft);
    expect(onOpenChat).toHaveBeenCalledTimes(1);

    await view.rerender(
      <ProgressNextMoveCard
        nextMove={progressMove}
        onOpenChat={onOpenChat}
        onDismiss={onDismiss}
        dismissing
        dismissError="Homa could not hide this yet."
      />,
    );
    const notToday = view.getByRole("button", { name: "Not today" });
    expect(notToday).toBeDisabled();
    expect(notToday).toBeBusy();
    expect(view.getByRole("alert")).toHaveTextContent(
      "Homa could not hide this yet.",
    );
  });

  it("keeps a parent choice optional, named, and one question at a time", async () => {
    const onSendAnswers = jest.fn();
    const onTypeInstead = jest.fn();
    const view = await render(
      <QuestionCard
        card={oneQuestion}
        active
        onSendAnswers={onSendAnswers}
        onTypeInstead={onTypeInstead}
      />,
    );

    expect(
      view.getByRole("header", {
        name: "Question 1 of 1. When would this feel easiest tomorrow?",
      }),
    ).toBeVisible();
    const breakfast = view.getByRole("radio", { name: "After breakfast" });
    expect(breakfast).not.toBeChecked();
    expect(breakfast).toHaveStyle({ minHeight: 48 });
    expect(
      view.getByRole("button", { name: "Type something else" }),
    ).toHaveStyle({ minHeight: 44 });
    expect(view.getByRole("button", { name: "Skip" })).toHaveStyle({
      minHeight: 44,
    });

    await fireEvent.press(breakfast);
    expect(onSendAnswers).toHaveBeenCalledWith("After breakfast");
    expect(onSendAnswers).toHaveBeenCalledTimes(1);
  });

  it("announces calendar ownership and time as one predictable stop", async () => {
    const readOnly = await render(
      <EventCard
        event={familyEvent}
        childIndex={0}
        audienceLabel="Mia"
      />,
    );
    expect(
      readOnly.getByLabelText("Library visit. Mia. 10am"),
    ).toHaveStyle({ minHeight: 44 });

    await readOnly.unmount();
    const onPress = jest.fn();
    const editable = await render(
      <EventCard
        event={familyEvent}
        childIndex={0}
        audienceLabel="Mia"
        onPress={onPress}
      />,
    );
    const edit = editable.getByRole("button", {
      name: "Edit Library visit. Mia. 10am",
    });
    expect(edit).toHaveStyle({ minHeight: 44 });
    await fireEvent.press(edit);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
