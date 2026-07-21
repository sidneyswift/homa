/**
 * Routing fixtures for the choice card (agent/tools/ask_user_questions.ts).
 *
 * What is under test is model judgment, not plumbing: given a real parent
 * message, does Homa reach for the card or not. The unit guards in
 * apps/web/app/app/ask-user-questions-tool.test.ts already prove the
 * channel gate and the output contract deterministically, so nothing
 * here re-tests those.
 *
 * Negatives outnumber positives on purpose. A tool that renders a
 * pleasing card is easy to over-call, and every over-call spends a
 * parent's turn making her do work Homa should have done. Each negative
 * names the specific failure mode it defends, and those modes are the
 * ones the tool description and instructions.md explicitly forbid.
 */

export type AskUserQuestionsExpectation = "ask" | "no_ask";

/** The forbidden-call modes each negative fixture defends against. */
export const ASK_USER_QUESTIONS_FAILURE_MODES = [
  "yes_no_confirmation",
  "answerable_in_a_sentence",
  "work_she_should_just_do",
  "already_answered",
  "only_one_real_option",
  "emotional_moment",
] as const;

export type AskUserQuestionsFailureMode =
  (typeof ASK_USER_QUESTIONS_FAILURE_MODES)[number];

export interface AskUserQuestionsFixture {
  id: string;
  /** The family block Homa sees this turn, in plain words. */
  familyBlurb: string;
  /** What the parent just said. */
  message: string;
  expect: AskUserQuestionsExpectation;
  /** Why that is the right call, in one sentence. */
  why: string;
  /** Set on negatives only: the over-call this fixture defends against. */
  failureMode?: AskUserQuestionsFailureMode;
}

export const ASK_USER_QUESTIONS_FIXTURES: readonly AskUserQuestionsFixture[] = [
  // Positives: a real fork, where every option is one Homa could act on
  // this turn and picking wrong wastes the parent's time.
  {
    id: "positive-approach-fork",
    familyBlurb: "Maya is 7. No Spanish on the planner yet.",
    message:
      "I want to start Spanish with Maya but I have no idea how to begin.",
    expect: "ask",
    why:
      "Immersion, vocabulary drilling, and songs-and-stories are genuinely different starts, all buildable, and the wrong guess wastes her week.",
  },
  {
    id: "positive-which-child",
    familyBlurb: "Three children: Maya is 7, Jordan is 9, Skye is 4.",
    message: "Can you make a reading practice page?",
    expect: "ask",
    why:
      "A reading page for a 4 year old and a 9 year old share nothing, and the family has three children with no clue in the message.",
  },
  {
    id: "positive-week-shape",
    familyBlurb:
      "Jordan is 9. The planner has a light week: two math activities, nothing else.",
    message:
      "We suddenly have a free week because co-op is cancelled. What should we do with it?",
    expect: "ask",
    why:
      "Going deeper on what is already planned versus starting something new are both good and lead to different work.",
  },

  // Negatives: each is a plausible over-call.
  {
    id: "negative-yes-no",
    familyBlurb: "Skye is 4. A counting page was just made.",
    message: "Should I print that one out?",
    expect: "no_ask",
    why: "A yes or no answer is a sentence, not a card of options.",
    failureMode: "yes_no_confirmation",
  },
  {
    id: "negative-answerable",
    familyBlurb: "Maya is 7 and loves horses.",
    message: "What's a good read-aloud for a 7 year old?",
    expect: "no_ask",
    why:
      "This is a question for Homa to answer, not a decision to hand back to the parent.",
    failureMode: "answerable_in_a_sentence",
  },
  {
    id: "negative-just-do-it",
    familyBlurb: "Skye is 4 and is working on counting to 10.",
    message: "Can you make Skye a counting page for tomorrow?",
    expect: "no_ask",
    why:
      "One clear path exists and Homa should build it, then offer changes; asking first is checking work she should just do.",
    failureMode: "work_she_should_just_do",
  },
  {
    id: "negative-already-answered",
    familyBlurb: "Three children: Maya is 7, Jordan is 9, Skye is 4.",
    message:
      "Can you make a reading page for Jordan? Something on the harder side, he's bored.",
    expect: "no_ask",
    why:
      "She already named the child and the difficulty, so there is nothing left to pick.",
    failureMode: "already_answered",
  },
  {
    id: "negative-one-option",
    familyBlurb: "Maya is 7. Only one child in the family.",
    message: "Can you log the two hours we did this morning?",
    expect: "no_ask",
    why: "There is one child and one action, so no fork exists to offer.",
    failureMode: "only_one_real_option",
  },
  {
    id: "negative-venting",
    familyBlurb: "Jordan is 9 and has been struggling with long division.",
    message:
      "Today was awful. Jordan cried through math again and I'm wondering if I'm even cut out for this.",
    expect: "no_ask",
    why:
      "She needs to be heard, and answering a hard moment with a menu of options is cold.",
    failureMode: "emotional_moment",
  },
];
