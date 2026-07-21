/**
 * Fixtures for the journaling-trigger eval (signal-capture audit
 * 2026-07-21 §4.4 item 1, founder ruling `progress-signal-capture-v2`
 * D9).
 *
 * This is the stage that failed silently in production: Story's family
 * messaged daily from July 13 to 21 and Homa never once called
 * manage_child_progress, so nine days of a mother's reports left no
 * trace. Nothing in the repo could detect that, and PR #79 broadened
 * the trigger wording with no way to measure whether it worked. These
 * fixtures are that measurement.
 *
 * A fixture pins what Homa must DO with a message, never what she
 * should say. `journals` cases must reach the child's record;
 * `silent` cases must not touch it, because a record that fills up
 * with worksheet requests and logistics is worth less than an empty
 * one.
 */

export interface TriggerFamilyChild {
  id: string;
  name: string;
  ageLabel: string;
}

/** One family shape shared by the fixtures, so the context block the
 *  model reads is realistic (three children, real-looking ids). */
export const TRIGGER_FAMILY: readonly TriggerFamilyChild[] = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Story", ageLabel: "4 years old" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Miles", ageLabel: "6 years old" },
  { id: "33333333-3333-4333-8333-333333333333", name: "June", ageLabel: "9 years old" },
];

export interface TriggerFixture {
  id: string;
  /** Exactly what the parent sent. */
  message: string;
  /**
   * journals: record_journal_evidence must be called.
   * silent:   it must NOT be called; this message is not about what a
   *           child can do.
   */
  expect: "journals" | "silent";
  /**
   * Child names the call (or calls) must name. Empty for `silent`.
   * More than one name means the message covers several children and
   * each one needs its own call (the founder's fan-out requirement).
   */
  childNames: readonly string[];
  source: "prod_chat" | "prod_lesson" | "instructions" | "audit";
  note: string;
}

export const JOURNALING_TRIGGER_FIXTURES: readonly TriggerFixture[] = [
  // ---- Must reach the record ----
  {
    id: "capability-explicit",
    message: "Story read a whole early reader by herself today!",
    expect: "journals",
    childNames: ["Story"],
    source: "instructions",
    note: "The strongest signal tier and instructions.md's own example.",
  },
  {
    id: "capability-negative",
    message: "Miles still can't pedal his bike without help",
    expect: "journals",
    childNames: ["Miles"],
    source: "instructions",
    note: "A cannot-yet report is signal too; the record needs the floor.",
  },
  {
    id: "day-recap",
    message: "We did letter sounds with Story this morning and she got most of them",
    expect: "journals",
    childNames: ["Story"],
    source: "instructions",
    note: "PR #79's broadening. The exact shape that produced nothing for nine days.",
  },
  {
    id: "completion-report",
    message: "She finished the counting page you made, got them all right",
    expect: "journals",
    childNames: ["Story"],
    source: "prod_chat",
    note: "Worksheet completion, pronoun subject, following a materials request.",
  },
  {
    id: "milestone-aside",
    message:
      "June has been reading chapter books to herself at bedtime this week, I didn't even ask her to",
    expect: "journals",
    childNames: ["June"],
    source: "audit",
    note: "Volunteered milestone buried in a chatty message.",
  },
  {
    id: "struggle-report",
    message: "Miles struggled with his math page today, lots of tears",
    expect: "journals",
    childNames: ["Miles"],
    source: "audit",
    note: "A hard day is still evidence; it must not be read as a support request only.",
  },
  {
    id: "lesson-style-recap",
    message: "Story counted to five with the coins but lost track after ten",
    expect: "journals",
    childNames: ["Story"],
    source: "prod_lesson",
    note: "Shaped from the first real recorded lesson.",
  },

  // ---- Must fan out across children ----
  {
    id: "fan-out-collective",
    message: "We all went on a scavenger hunt for the 50 states this afternoon",
    expect: "journals",
    childNames: ["Story", "Miles", "June"],
    source: "audit",
    note: "The founder's own scenario: one activity, one call per child.",
  },
  {
    id: "fan-out-two-named",
    message:
      "June wrote a full page of cursive today and Miles finally counted past 20",
    expect: "journals",
    childNames: ["June", "Miles"],
    source: "audit",
    note: "Two children, two capabilities, in one message.",
  },

  // ---- Must never touch the record ----
  {
    id: "material-request",
    message: "Can you make me an addition worksheet for Story using paw patrol",
    expect: "silent",
    childNames: [],
    source: "prod_chat",
    note: "Real prod message. Names a child and a subject but reports nothing.",
  },
  {
    id: "planning-question",
    message: "What should we work on this week?",
    expect: "silent",
    childNames: [],
    source: "prod_chat",
    note: "Real prod message, asked three times by one family.",
  },
  {
    id: "planner-logistics",
    message: "adjust my planner week",
    expect: "silent",
    childNames: [],
    source: "prod_chat",
    note: "Real prod message: pure logistics.",
  },
  {
    id: "product-feedback",
    message:
      "This looks awful. The images are not even coming up. Going forward before you send me anything it needs to be double checked",
    expect: "silent",
    childNames: [],
    source: "prod_chat",
    note: "Real prod message: feedback about Homa, not about a child.",
  },
  {
    id: "curriculum-question",
    message: "Do you think all about reading would be a good curriculum for Story?",
    expect: "silent",
    childNames: [],
    source: "prod_chat",
    note: "Real prod message: an opinion request, no observation.",
  },
  {
    id: "venting",
    message: "I am so tired of fighting about school every single morning",
    expect: "silent",
    childNames: [],
    source: "audit",
    note: "Distress, not evidence. Journaling this would be a betrayal of the moment.",
  },
  {
    id: "other-child",
    message: "My sister's kid read a chapter book at five, is that normal?",
    expect: "silent",
    childNames: [],
    source: "audit",
    note: "Another family's child must never credit this family's.",
  },
  {
    id: "future-intent",
    message: "Tomorrow I want to start Miles on multiplication",
    expect: "silent",
    childNames: [],
    source: "audit",
    note: "A plan, not an observation; nothing has happened yet.",
  },
];
