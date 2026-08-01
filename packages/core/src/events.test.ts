import assert from "node:assert/strict";
import test from "node:test";

import { EVENT_SCHEMAS } from "./events";
import { MAP_ANSWERS } from "./map/bank";

const FAMILY_ID = "00000000-0000-4000-8000-000000000001";
const CHILD_ID = "00000000-0000-4000-8000-000000000002";
const TASK_RUN_ID = "00000000-0000-4000-8000-000000000003";

const validSubjectLessonEvents = {
  "map.subject_lesson_requested": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
  },
  "map.subject_lesson_started": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    attempt: 1,
  },
  "map.subject_lesson_ready": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    attempt: 1,
  },
  "map.subject_lesson_failed": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    attempt: 1,
    error_code: "build_failed",
  },
  "map.subject_lesson_retried": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    attempt: 2,
  },
  "map.subject_lesson_kept": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
  },
} as const;

type SubjectLessonEventName = keyof typeof validSubjectLessonEvents;

const subjectLessonAttemptEventNames = [
  "map.subject_lesson_started",
  "map.subject_lesson_ready",
  "map.subject_lesson_failed",
  "map.subject_lesson_retried",
] as const satisfies ReadonlyArray<SubjectLessonEventName>;

function subjectLessonEventSchema(name: SubjectLessonEventName) {
  const schema = EVENT_SCHEMAS[name as keyof typeof EVENT_SCHEMAS];
  assert.ok(schema, `${name} is missing from the event registry`);
  return schema;
}

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

test("subject lesson event registry contains the retained build and Keep names", () => {
  assert.deepEqual(
    Object.keys(EVENT_SCHEMAS)
      .filter((name) => name.startsWith("map.subject_lesson_"))
      .sort(),
    Object.keys(validSubjectLessonEvents).sort(),
  );
});

test("subject lesson event schemas accept every exact valid shape", () => {
  for (const [name, props] of Object.entries(validSubjectLessonEvents)) {
    assert.equal(
      subjectLessonEventSchema(name as SubjectLessonEventName).safeParse(props)
        .success,
      true,
      name,
    );
  }
});

test("subject lesson events reject malformed UUIDs and extra properties", () => {
  for (const [name, props] of Object.entries(validSubjectLessonEvents)) {
    const schema = subjectLessonEventSchema(name as SubjectLessonEventName);
    assert.equal(
      schema.safeParse({ ...props, family_id: "not-a-uuid" }).success,
      false,
      `${name} accepted a malformed family UUID`,
    );
    assert.equal(
      schema.safeParse({ ...props, child_id: "not-a-uuid" }).success,
      false,
      `${name} accepted a malformed child UUID`,
    );
    assert.equal(
      schema.safeParse({ ...props, extra: "not-allowed" }).success,
      false,
      `${name} accepted an extra property`,
    );
  }
});

test("subject lesson attempt events require positive integers", () => {
  for (const name of subjectLessonAttemptEventNames) {
    const schema = subjectLessonEventSchema(name);
    const props = validSubjectLessonEvents[name];
    for (const attempt of [0, -1, 1.5, "1"]) {
      assert.equal(
        schema.safeParse({ ...props, attempt }).success,
        false,
        `${name} accepted attempt ${String(attempt)}`,
      );
    }
  }
});

test("subject lesson failure error codes are present and bounded", () => {
  const schema = subjectLessonEventSchema("map.subject_lesson_failed");
  const props = validSubjectLessonEvents["map.subject_lesson_failed"];
  assert.equal(
    schema.safeParse({ ...props, error_code: "" }).success,
    false,
  );
  assert.equal(
    schema.safeParse({ ...props, error_code: "x".repeat(81) }).success,
    false,
  );
  const { error_code: _errorCode, ...withoutErrorCode } = props;
  assert.equal(schema.safeParse(withoutErrorCode).success, false);
});

test("only HTML material creation accepts the subject lesson channel", () => {
  const created = {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    channel: "subject_lesson",
    kind: "worksheet",
    source: "html",
    reviewed: true,
    review_passed: true,
    sent_by_text: false,
    duration_ms: 100,
  } as const;
  assert.equal(
    EVENT_SCHEMAS["materials.created"].safeParse(created).success,
    true,
  );
  assert.equal(
    EVENT_SCHEMAS["materials.created"].safeParse({
      ...created,
      channel: "subject-lesson",
    }).success,
    false,
  );

  const prohibitedSubjectLessonEvents = {
    "materials.image_generated": {
      family_id: FAMILY_ID,
      channel: "subject_lesson",
      duration_ms: 100,
      has_references: false,
    },
    "materials.finalized": {
      family_id: FAMILY_ID,
      channel: "subject_lesson",
      versions_superseded: 0,
    },
    "materials.photo_searched": {
      family_id: FAMILY_ID,
      channel: "subject_lesson",
      results: 1,
      duration_ms: 100,
    },
    "materials.photo_imported": {
      family_id: FAMILY_ID,
      channel: "subject_lesson",
      bytes: 100,
      duration_ms: 100,
    },
  } as const;

  for (const [name, props] of Object.entries(prohibitedSubjectLessonEvents)) {
    const schema = EVENT_SCHEMAS[name as keyof typeof EVENT_SCHEMAS];
    assert.equal(
      schema.safeParse(props).success,
      false,
      `${name} accepted the automatic lesson channel`,
    );
    assert.equal(
      schema.safeParse({ ...props, channel: "web" }).success,
      true,
      `${name} rejected the ordinary web channel`,
    );
  }
});

test("native print results carry bounded operational facts only", () => {
  const event = {
    family_id: FAMILY_ID,
    material_id: "11111111-1111-4111-8111-111111111111",
    outcome: "completed",
    requested_copies: 2,
    pages_selected: 1,
    answer_key_excluded: true,
  } as const;
  assert.equal(EVENT_SCHEMAS["materials.print_result"].safeParse(event).success, true);
  assert.equal(
    EVENT_SCHEMAS["materials.print_result"].safeParse({ ...event, requested_copies: 0 }).success,
    false,
  );
});

test("native share results record handoff state without destination or message", () => {
  const event = {
    family_id: "11111111-1111-4111-8111-111111111111",
    material_id: "22222222-2222-4222-8222-222222222222",
    outcome: "handed_off",
  };
  assert.equal(EVENT_SCHEMAS["materials.share_result"].safeParse(event).success, true);
  const parsed = EVENT_SCHEMAS["materials.share_result"].parse({ ...event, destination: "mail" });
  assert.equal("destination" in parsed, false);
  assert.equal(EVENT_SCHEMAS["materials.share_result"].safeParse({ ...event, outcome: "delivered" }).success, false);
});

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
    resolution_method: "provider_reply",
    classifier_version: "reply-intent-v3",
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

test("offer fulfillment events carry only family and deterministic effect kind", () => {
  const event = {
    family_id: FAMILY_ID,
    source: "morning_brief",
    fulfillment_kind: "material",
  };
  const schema = EVENT_SCHEMAS["conversation.offer_fulfilled"];

  assert.equal(schema.safeParse(event).success, true);
  assert.equal(
    schema.safeParse({
      ...event,
      message: "private offer content",
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

test("delegated session event accepts only its PII-free lineage shape", () => {
  const delegatedSessionEvent = {
    family_id: FAMILY_ID,
    child_session_hash: "a".repeat(64),
    parent_session_hash: "b".repeat(64),
    root_session_hash: "c".repeat(64),
  };

  assert.equal(
    EVENT_SCHEMAS["conversation.session_delegated"].safeParse(
      delegatedSessionEvent,
    ).success,
    true,
  );

  const forbiddenProperties = [
    "child_session_id",
    "parent_session_id",
    "email",
    "phone",
    "message",
  ] as const;

  for (const property of forbiddenProperties) {
    assert.equal(
      EVENT_SCHEMAS["conversation.session_delegated"].safeParse({
        ...delegatedSessionEvent,
        [property]: "forbidden",
      }).success,
      false,
      `conversation.session_delegated accepted ${property}`,
    );
  }
});

// The one-planner arc namespace (issue #257, arc PR B0): ids, subject
// ids, week numbers, and enums only, and strict shapes, so activity
// text or event titles can never ride an emit into analytics.
const validPlannerEvents = {
  "planner.viewed": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    surface: "chat",
    client: "web",
  },
  "planner.activity_scheduled": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    week: 2,
    surface: "chat",
    client: "sms",
  },
  "planner.week_repaired": {
    family_id: FAMILY_ID,
    moves: 2,
    surface: "chat",
    client: "web",
  },
  "planner.offer_shown": { family_id: FAMILY_ID, venue: "empty_grid" },
  "planner.offer_accepted": { family_id: FAMILY_ID, venue: "morning_brief" },
  "planner.checkoff": {
    family_id: FAMILY_ID,
    child_id: CHILD_ID,
    subject: "math",
    register: "rail",
    surface: "grid",
    client: "web",
  },
  "planner.month_draft_requested": {
    family_id: FAMILY_ID,
    draft_id: TASK_RUN_ID,
    child_count: 2,
    client: "mobile",
  },
  "planner.month_preview_ready": {
    family_id: FAMILY_ID,
    draft_id: TASK_RUN_ID,
    revision: 1,
    conflict_count: 1,
    unresolved_count: 2,
    client: "mobile",
  },
  "planner.month_approved": {
    family_id: FAMILY_ID,
    draft_id: TASK_RUN_ID,
    revision: 2,
    child_count: 2,
    client: "mobile",
  },
  "planner.month_revised": {
    family_id: FAMILY_ID,
    draft_id: TASK_RUN_ID,
    revision: 2,
    client: "mobile",
  },
  "planner.month_abandoned": {
    family_id: FAMILY_ID,
    draft_id: TASK_RUN_ID,
    revision: 2,
    client: "mobile",
  },
  "planner.month_restored": {
    family_id: FAMILY_ID,
    draft_id: TASK_RUN_ID,
    revision: 3,
    restored_from: 1,
    client: "mobile",
  },
} as const;

test("planner events accept every exact valid shape", () => {
  for (const [name, props] of Object.entries(validPlannerEvents)) {
    const schema = EVENT_SCHEMAS[name as keyof typeof EVENT_SCHEMAS];
    assert.ok(schema, `${name} is missing from the event registry`);
    assert.equal(schema.safeParse(props).success, true, name);
  }
});

test("planner events reject extra properties and content-shaped props", () => {
  for (const [name, props] of Object.entries(validPlannerEvents)) {
    const schema = EVENT_SCHEMAS[name as keyof typeof EVENT_SCHEMAS];
    assert.equal(
      schema.safeParse({ ...props, extra: "not-allowed" }).success,
      false,
      `${name} accepted an extra property`,
    );
    assert.equal(
      schema.safeParse({ ...props, title: "Dentist appointment" }).success,
      false,
      `${name} accepted an event title`,
    );
    assert.equal(
      schema.safeParse({ ...props, family_id: "not-a-uuid" }).success,
      false,
      `${name} accepted a malformed family UUID`,
    );
  }
});

test("planner enums are closed sets", () => {
  assert.equal(
    EVENT_SCHEMAS["planner.viewed"].safeParse({
      ...validPlannerEvents["planner.viewed"],
      surface: "dashboard",
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["planner.viewed"].safeParse({
      ...validPlannerEvents["planner.viewed"],
      client: "carrier-pigeon",
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["planner.activity_scheduled"].safeParse({
      ...validPlannerEvents["planner.activity_scheduled"],
      week: 5,
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["planner.checkoff"].safeParse({
      ...validPlannerEvents["planner.checkoff"],
      register: "list",
    }).success,
    false,
  );
  assert.equal(
    EVENT_SCHEMAS["planner.offer_shown"].safeParse({
      family_id: FAMILY_ID,
      venue: "push_notification",
    }).success,
    false,
  );
});

test("planner.viewed child narrowing is optional, family id is not", () => {
  const { child_id: _childId, ...familyWide } = validPlannerEvents["planner.viewed"];
  assert.equal(EVENT_SCHEMAS["planner.viewed"].safeParse(familyWide).success, true);
  const { family_id: _familyId, ...withoutFamily } = validPlannerEvents["planner.viewed"];
  assert.equal(EVENT_SCHEMAS["planner.viewed"].safeParse(withoutFamily).success, false);
});
