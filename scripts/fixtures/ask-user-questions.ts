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
  "homa_could_settle_it",
] as const;

export type AskUserQuestionsFailureMode =
  (typeof ASK_USER_QUESTIONS_FAILURE_MODES)[number];

export interface FixtureChild {
  id: string;
  name: string;
  age: number;
}

export interface AskUserQuestionsFixture {
  id: string;
  /** The family block Homa sees this turn, in plain words. */
  familyBlurb: string;
  /** Drives a realistic get_children result. Homa cannot judge which
   * child is meant if the roster comes back empty. */
  children: readonly FixtureChild[];
  /** What the parent just said. */
  message: string;
  expect: AskUserQuestionsExpectation;
  /** Why that is the right call, in one sentence. */
  why: string;
  /** Set on negatives only: the over-call this fixture defends against. */
  failureMode?: AskUserQuestionsFailureMode;
  /**
   * Realistic results for the tools this scenario actually reaches for,
   * merged over the shared defaults. A tool that answers "no result"
   * teaches Homa nothing, and an agent that learns nothing falls back on
   * asking, which would quietly rig every fixture toward the card.
   */
  toolResults?: Readonly<Record<string, unknown>>;
}

/**
 * What an unlisted tool returns. Deliberately a plausible EMPTY success
 * rather than a failure: "I looked and there is nothing saved" is a real
 * answer Homa can act on, where "no result available" reads as a broken
 * tool and invites her to ask instead.
 */
export const DEFAULT_TOOL_RESULT = {
  ok: true,
  note: "Nothing saved for this yet.",
} as const;

export const ASK_USER_QUESTIONS_FIXTURES: readonly AskUserQuestionsFixture[] = [
  // Positives, under the reluctant doctrine (founder ruling 2026-07-21,
  // build first and card rarely): only a fact Homa cannot research, pick
  // well herself, or infer from the family block.
  {
    id: "positive-which-child",
    familyBlurb: "Three children: Maya is 7, Jordan is 9, Skye is 4.",
    children: [
      { id: "c-maya", name: "Maya", age: 7 },
      { id: "c-jordan", name: "Jordan", age: 9 },
      { id: "c-skye", name: "Skye", age: 4 },
    ],
    message: "Can you make a reading practice page?",
    expect: "ask",
    why:
      "A reading page for a 4 year old and a 9 year old share nothing, and the family has three children with no clue in the message.",
  },
  {
    id: "positive-which-curriculum",
    familyBlurb:
      "Jordan is 9. The family owns two science curriculums and is partway through both: Blossom & Root Year 2 and Elemental Science.",
    children: [{ id: "c-jordan", name: "Jordan", age: 9 }],
    toolResults: {
      find_curriculum_profile: {
        ok: true,
        curriculums: [
          { name: "Blossom & Root Year 2", subject: "science", inProgress: true },
          { name: "Elemental Science", subject: "science", inProgress: true },
        ],
      },
    },
    message: "Can you pull up tomorrow's science lesson for Jordan?",
    expect: "ask",
    why:
      "Which of the two they mean is a fact about their household that no research or good judgment can recover.",
  },

  // Negatives: each is a plausible over-call.
  // The two below were written as positives and failed 0/3, because Homa
  // researched and proposed instead of asking. The founder ruled that
  // behavior correct (build first, card rarely), so the fixtures were
  // wrong, not Homa. They now defend the doctrine they violated.
  {
    id: "negative-approach-fork",
    familyBlurb: "Maya is 7. No Spanish on the planner yet.",
    children: [{ id: "c-maya", name: "Maya", age: 7 }],
    toolResults: {
      find_curriculum_profile: {
        ok: true,
        note: "Beginner Spanish for this age usually starts with spoken songs and picture vocabulary before any reading or grammar.",
      },
    },
    message:
      "I want to start Spanish with Maya but I have no idea how to begin.",
    expect: "no_ask",
    why:
      "Homa can research how Spanish is usually started and propose one way; handing back a menu makes the parent do the deciding she came here to avoid.",
    failureMode: "homa_could_settle_it",
  },
  {
    id: "negative-week-shape",
    familyBlurb:
      "Jordan is 9. The planner has a light week: two math activities, nothing else.",
    children: [{ id: "c-jordan", name: "Jordan", age: 9 }],
    toolResults: {
      open_planner: {
        opened: true,
        children: [
          {
            childName: "Jordan",
            plans: [
              {
                subjectName: "Math",
                weekFocus: "Long division with remainders",
                activities: [
                  { index: 0, text: "Two practice pages", done: false },
                  { index: 1, text: "Division card game", done: false },
                ],
              },
            ],
          },
        ],
      },
    },
    message:
      "We suddenly have a free week because co-op is cancelled. What should we do with it?",
    expect: "no_ask",
    why:
      "She asked for a suggestion, so Homa reads the planner and offers one; a card would return the question to her unanswered.",
    failureMode: "homa_could_settle_it",
  },
  {
    id: "negative-yes-no",
    familyBlurb: "Skye is 4. A counting page was just made.",
    children: [{ id: "c-skye", name: "Skye", age: 4 }],
    message: "Should I print that one out?",
    expect: "no_ask",
    why: "A yes or no answer is a sentence, not a card of options.",
    failureMode: "yes_no_confirmation",
  },
  {
    id: "negative-answerable",
    familyBlurb: "Maya is 7 and loves horses.",
    children: [{ id: "c-maya", name: "Maya", age: 7 }],
    message: "What's a good read-aloud for a 7 year old?",
    expect: "no_ask",
    why:
      "This is a question for Homa to answer, not a decision to hand back to the parent.",
    failureMode: "answerable_in_a_sentence",
  },
  {
    id: "negative-just-do-it",
    familyBlurb: "Skye is 4 and is working on counting to 10.",
    children: [{ id: "c-skye", name: "Skye", age: 4 }],
    toolResults: {
      create_printable: {
        created: true,
        material: { id: "m-1", title: "Counting to 10", previewUrl: "https://example.test/p.png" },
      },
    },
    message: "Can you make Skye a counting page for tomorrow?",
    expect: "no_ask",
    why:
      "One clear path exists and Homa should build it, then offer changes; asking first is checking work she should just do.",
    failureMode: "work_she_should_just_do",
  },
  {
    id: "negative-already-answered",
    familyBlurb: "Three children: Maya is 7, Jordan is 9, Skye is 4.",
    children: [
      { id: "c-maya", name: "Maya", age: 7 },
      { id: "c-jordan", name: "Jordan", age: 9 },
      { id: "c-skye", name: "Skye", age: 4 },
    ],
    toolResults: {
      create_printable: {
        created: true,
        material: { id: "m-2", title: "Reading practice", previewUrl: "https://example.test/r.png" },
      },
    },
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
    children: [{ id: "c-maya", name: "Maya", age: 7 }],
    message: "Can you log the two hours we did this morning?",
    expect: "no_ask",
    why: "There is one child and one action, so no fork exists to offer.",
    failureMode: "only_one_real_option",
  },
  {
    id: "negative-venting",
    familyBlurb: "Jordan is 9 and has been struggling with long division.",
    children: [{ id: "c-jordan", name: "Jordan", age: 9 }],
    message:
      "Today was awful. Jordan cried through math again and I'm wondering if I'm even cut out for this.",
    expect: "no_ask",
    why:
      "She needs to be heard, and answering a hard moment with a menu of options is cold.",
    failureMode: "emotional_moment",
  },
];
