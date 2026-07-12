import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProgressConflictCard } from "./progress-conflict-card";
import { ProgressQuestionCard } from "./progress-question-card";
import { ProgressUpdateChip } from "./progress-update-chip";
import type {
  ProgressConflictCardData,
  ProgressQuestionCardData,
  ProgressUpdateCardData,
} from "./progress-message-parts";

interface TestElementProps {
  children?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}

function visitElements(
  node: ReactNode,
  visit: (element: ReactElement<TestElementProps>) => void,
): void {
  if (Array.isArray(node)) {
    for (const child of node) visitElements(child, visit);
    return;
  }
  if (!isValidElement<TestElementProps>(node)) return;
  visit(node);
  visitElements(node.props.children, visit);
}

function visibleText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(visibleText).join("");
  if (!isValidElement<TestElementProps>(node)) return "";
  return visibleText(node.props.children);
}

function buttonsIn(node: ReactNode): ReactElement<TestElementProps>[] {
  const buttons: ReactElement<TestElementProps>[] = [];
  visitElements(node, (element) => {
    if (element.type === "button") buttons.push(element);
  });
  return buttons;
}

function buttonWithText(
  node: ReactNode,
  label: string,
): ReactElement<TestElementProps> {
  const button = buttonsIn(node).find(
    (candidate) => visibleText(candidate) === label,
  );
  assert.ok(button, `Expected button "${label}"`);
  return button;
}

const UPDATE: ProgressUpdateCardData = {
  label: "Progress updated",
  childName: "Maya",
  affectedTopics: ["Counts out loud from 1 to 5"],
  undoAvailable: true,
};

const QUESTION: ProgressQuestionCardData = {
  childName: "Maya",
  subjectDisplayName: "Math",
  statement: "Can Maya count out loud from 1 to 5?",
  answerLabels: [
    "Easily",
    "Getting there",
    "Not yet",
    "Not sure",
    "Skip",
  ],
  update: UPDATE,
};

const CONFLICT: ProgressConflictCardData = {
  label: "Please confirm",
  question: "Which answer fits Maya today?",
  childName: "Maya",
  subjectDisplayName: "Math",
  skillStatement: "Maya counts out loud from 1 to 5.",
  answers: [
    {
      answerLabel: "Easily",
      adultDisplayName: "Elena",
      observedAt: "2026-07-12T01:30:00.000Z",
      source: "conversation",
    },
    {
      answerLabel: "Not yet",
      adultDisplayName: "Jordan",
      observedAt: "2026-07-12T02:00:00.000Z",
      source: "check_in",
    },
  ],
  optionLabels: ["Easily", "Not yet", "Ask me later"],
};

describe("ProgressUpdateChip", () => {
  it("sends the fixed parent-visible undo request without a token", () => {
    const sent: string[] = [];
    const tree = ProgressUpdateChip({
      update: UPDATE,
      onSendSuggestion: (message) => sent.push(message),
    });

    buttonWithText(tree, "Undo").props.onClick?.();

    assert.deepEqual(sent, ["Undo that progress update."]);
    const html = renderToStaticMarkup(
      <ProgressUpdateChip
        update={UPDATE}
        onSendSuggestion={(message) => sent.push(message)}
      />,
    );
    assert.match(html, /Progress updated/u);
    assert.match(html, /min-h-11/u);
  });
});

describe("ProgressQuestionCard", () => {
  it("sends the selected visible answer label exactly", () => {
    const sent: string[] = [];
    const tree = ProgressQuestionCard({
      card: QUESTION,
      onSendSuggestion: (message) => sent.push(message),
      onFocusComposer() {},
    });

    buttonWithText(tree, "Getting there").props.onClick?.();

    assert.deepEqual(sent, ["Getting there"]);
  });

  it("sends Save and stop exactly", () => {
    const sent: string[] = [];
    const tree = ProgressQuestionCard({
      card: QUESTION,
      onSendSuggestion: (message) => sent.push(message),
      onFocusComposer() {},
    });

    buttonWithText(tree, "Save and stop").props.onClick?.();

    assert.deepEqual(sent, ["Save and stop"]);
  });

  it("focuses the composer without sending from Ask HOMA something else", () => {
    const sent: string[] = [];
    let focusCount = 0;
    const tree = ProgressQuestionCard({
      card: QUESTION,
      onSendSuggestion: (message) => sent.push(message),
      onFocusComposer: () => {
        focusCount += 1;
      },
    });

    buttonWithText(tree, "Ask HOMA something else").props.onClick?.();

    assert.equal(focusCount, 1);
    assert.deepEqual(sent, []);
  });

  it("renders the nested update before one canonical server statement", () => {
    const html = renderToStaticMarkup(
      <ProgressQuestionCard card={QUESTION} />,
    );

    assert.match(html, /Maya · Math · one question at a time/u);
    assert.equal(
      html.match(/Can Maya count out loud from 1 to 5\?/gu)?.length,
      1,
    );
    assert.ok(
      html.indexOf("Progress updated") <
        html.indexOf("Can Maya count out loud from 1 to 5?"),
    );
    assert.match(html, /role="group"[^>]*aria-label="Answer options"/u);
  });

  it("disables every action when handlers are omitted", () => {
    const buttons = buttonsIn(ProgressQuestionCard({ card: QUESTION }));

    assert.ok(buttons.length > 0);
    assert.equal(
      buttons.every((button) => button.props.disabled === true),
      true,
    );
  });
});

describe("ProgressConflictCard", () => {
  it("shows both adult observations, family-local dates, and every option", () => {
    const html = renderToStaticMarkup(
      <ProgressConflictCard
        card={CONFLICT}
        timeZone="America/Los_Angeles"
      />,
    );

    for (const text of [
      "Please confirm",
      "Maya counts out loud from 1 to 5.",
      "Elena",
      "Easily",
      "Conversation",
      "Jordan",
      "Not yet",
      "Check-in",
      "Jul 11, 2026",
      "Which answer fits Maya today?",
      "Ask me later",
    ]) {
      assert.match(html, new RegExp(text.replaceAll(".", "\\."), "u"));
    }
    assert.match(html, /bg-gold/u);
    assert.match(
      html,
      /role="group"[^>]*aria-label="Confirmation options"/u,
    );
  });

  it("uses a fixed safe date label for an invalid family time zone", () => {
    const html = renderToStaticMarkup(
      <ProgressConflictCard
        card={CONFLICT}
        timeZone="Mars/Olympus_Mons"
      />,
    );

    assert.match(html, /Conversation · Date unavailable/u);
    assert.match(html, /Check-in · Date unavailable/u);
    assert.doesNotMatch(html, /Jul 11, 2026/u);
  });

  it("sends the selected visible conflict option exactly", () => {
    const sent: string[] = [];
    const tree = ProgressConflictCard({
      card: CONFLICT,
      timeZone: "America/Los_Angeles",
      onSendSuggestion: (message) => sent.push(message),
    });

    buttonWithText(tree, "Ask me later").props.onClick?.();

    assert.deepEqual(sent, ["Ask me later"]);
  });
});
