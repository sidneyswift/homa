import assert from "node:assert/strict";
import test from "node:test";

import { EVENT_SCHEMAS } from "./events";
import { MAP_ANSWERS } from "./map/bank";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const CHILD_ID = "00000000-0000-4000-8000-000000000002";
const TASK_RUN_ID = "00000000-0000-4000-8000-000000000003";

const validProgressEvents = {
  "progress.evidence_recorded": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    source: "journal",
    items: 2,
    supersedes: false,
  },
  "progress.checkin_started": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    scope: "subject",
    subject: "math",
  },
  "progress.checkin_answered": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    domain: "counting-cardinality",
    answer: "easily",
  },
  "progress.checkin_paused": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    reason: "topic_change",
  },
  "progress.checkin_resumed": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    takeover: false,
  },
  "progress.checkin_ended": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    outcome: "completed",
  },
  "progress.conflict_opened": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    domain: "counting-cardinality",
  },
  "progress.conflict_resolved": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    domain: "counting-cardinality",
    resolution: "confirmed",
  },
  "progress.projection_updated": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subjects_touched: 1,
    had_conflict: false,
  },
  "progress.observation_saved": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    classification: "no_match",
  },
  "progress.observation_used": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
  },
} as const;

test("progress event registry contains all eleven exact names", () => {
  assert.deepEqual(
    Object.keys(EVENT_SCHEMAS)
      .filter((name) => name.startsWith("progress."))
      .sort(),
    Object.keys(validProgressEvents).sort(),
  );
});

test("progress event schemas accept every exact valid shape", () => {
  for (const [name, props] of Object.entries(validProgressEvents)) {
    const schema =
      EVENT_SCHEMAS[name as keyof typeof validProgressEvents];
    assert.equal(schema.safeParse(props).success, true, name);
  }
});

test("progress check-in answers accept every MAP answer", () => {
  for (const answer of MAP_ANSWERS) {
    assert.equal(
      EVENT_SCHEMAS["progress.checkin_answered"].safeParse({
        ...validProgressEvents["progress.checkin_answered"],
        answer,
      }).success,
      true,
      answer,
    );
  }
});

test("progress event numeric boundaries are enforced", () => {
  assert.equal(
    EVENT_SCHEMAS["progress.evidence_recorded"].safeParse({
      ...validProgressEvents["progress.evidence_recorded"],
      items: 0,
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["progress.projection_updated"].safeParse({
      ...validProgressEvents["progress.projection_updated"],
      subjects_touched: 0,
    }).success,
    false,
  );
});

test("check-in scope keeps whole and multi-subject shapes exact", () => {
  assert.equal(
    EVENT_SCHEMAS["progress.checkin_started"].safeParse({
      family_id: FAMILY_ID,
      child_id: CHILD_ID,
      scope: "whole",
    }).success,
    true,
  );
  assert.equal(
    EVENT_SCHEMAS["progress.checkin_started"].safeParse({
      family_id: FAMILY_ID,
      child_id: CHILD_ID,
      scope: "subject",
    }).success,
    true,
  );
  assert.equal(
    EVENT_SCHEMAS["progress.checkin_started"].safeParse({
      family_id: FAMILY_ID,
      child_id: CHILD_ID,
      scope: "whole",
      subject: "math",
    }).success,
    false,
  );
});

test("progress dimensions accept identifiers, not display text", () => {
  assert.equal(
    EVENT_SCHEMAS["progress.checkin_answered"].safeParse({
      ...validProgressEvents["progress.checkin_answered"],
      subject: "Maya",
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["progress.conflict_opened"].safeParse({
      ...validProgressEvents["progress.conflict_opened"],
      domain: "Counting and cardinality",
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["progress.conflict_resolved"].safeParse({
      ...validProgressEvents["progress.conflict_resolved"],
      resolution: "deferred",
    }).success,
    false,
  );
});

test("progress events reject PII and operation identifiers", () => {
  const forbiddenProperties = [
    "quote",
    "item",
    "item_id",
    "itemId",
    "adult",
    "adult_name",
    "adultName",
    "contact",
    "email",
    "email_address",
    "phone",
    "phone_number",
    "message",
    "message_text",
    "operation",
    "operation_id",
    "operationId",
  ] as const;

  for (const [name, props] of Object.entries(validProgressEvents)) {
    const schema =
      EVENT_SCHEMAS[name as keyof typeof validProgressEvents];
    for (const property of forbiddenProperties) {
      assert.equal(
        schema.safeParse({ ...props, [property]: "forbidden" }).success,
        false,
        `${name} accepted ${property}`,
      );
    }
  }
});

const SUGGESTION_SET_ID = "00000000-0000-4000-8000-000000000003";

const validPromptSuggestionsShownEvent = {
  suggestion_set_id: SUGGESTION_SET_ID,
  prompt_version: "2026.07.15.1",
  source: "model",
  count: 2,
  latency_ms: 1480,
} as const;

const validPromptSuggestionTappedEvent = {
  suggestion_set_id: SUGGESTION_SET_ID,
  prompt_version: "2026.07.15.1",
  source: "model",
  position: 1,
} as const;

test("prompt suggestion measurement accepts exact content-free shapes", () => {
  assert.deepEqual(
    EVENT_SCHEMAS["chat.prompt_suggestions_shown"].parse(
      validPromptSuggestionsShownEvent,
    ),
    validPromptSuggestionsShownEvent,
  );
  assert.deepEqual(
    EVENT_SCHEMAS["chat.prompt_suggestion_tapped"].parse(
      validPromptSuggestionTappedEvent,
    ),
    validPromptSuggestionTappedEvent,
  );
});

test("prompt suggestion measurement enforces count and position bounds", () => {
  for (const count of [0, 3]) {
    assert.equal(
      EVENT_SCHEMAS["chat.prompt_suggestions_shown"].safeParse({
        ...validPromptSuggestionsShownEvent,
        count,
      }).success,
      false,
    );
  }
  assert.equal(
    EVENT_SCHEMAS["chat.prompt_suggestion_tapped"].safeParse({
      ...validPromptSuggestionTappedEvent,
      position: 2,
    }).success,
    false,
  );
});

test("prompt suggestion measurement rejects suggestion and conversation content", () => {
  assert.equal(
    EVENT_SCHEMAS["chat.prompt_suggestions_shown"].safeParse({
      ...validPromptSuggestionsShownEvent,
      suggestion_text: "Email the worksheet",
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["chat.prompt_suggestion_tapped"].safeParse({
      ...validPromptSuggestionTappedEvent,
      conversation: "private conversation text",
    }).success,
    false,
  );
});

test("completed chat turns accept an optional suggestion set correlation", () => {
  const completedTurn = {
    status: "ok",
    modality: "text",
    latency_ms: 1480,
    model_tier: "fast",
    tool_calls: 0,
  } as const;

  assert.equal(
    EVENT_SCHEMAS["chat.turn_completed"].safeParse(completedTurn).success,
    true,
  );
  assert.equal(
    EVENT_SCHEMAS["chat.turn_completed"].safeParse({
      ...completedTurn,
      suggestion_set_id: SUGGESTION_SET_ID,
    }).success,
    true,
  );
  assert.equal(
    EVENT_SCHEMAS["chat.turn_completed"].safeParse({
      ...completedTurn,
      suggestion_set_id: "not-a-uuid",
    }).success,
    false,
  );
});

test("reply resolution events require a causal outcome and reject content", () => {
  const event = {
    family_id: FAMILY_ID,
    channel: "email",
    resolution: "matched",
    resolved_outcome: "answered",
    cross_channel: false,
  };

  assert.equal(
    EVENT_SCHEMAS["conversation.reply_resolved"].safeParse(event).success,
    true,
  );
  assert.equal(
    EVENT_SCHEMAS["conversation.reply_resolved"].safeParse({
      ...event,
      resolved_outcome: undefined,
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["conversation.reply_resolved"].safeParse({
      ...event,
      message: "private reply content",
    }).success,
    false,
  );
});

test("research brief feedback records only a family and explicit signal", () => {
  const event = {
    family_id: FAMILY_ID,
    task_run_id: TASK_RUN_ID,
    signal: "helpful",
  };
  const schema = EVENT_SCHEMAS["research.brief_feedback"];

  assert.equal(schema.safeParse(event).success, true);
  assert.equal(
    schema.safeParse({ ...event, signal: "not_for_us" }).success,
    true,
  );
  assert.equal(
    schema.safeParse({ ...event, signal: "liked_it" }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...event, message: "private brief content" }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...event, member_user_id: CHILD_ID }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ family_id: FAMILY_ID, signal: "helpful" }).success,
    false,
  );
});
