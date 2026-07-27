/**
 * The parent-phrasing corpus behind the journal matcher's recall
 * measurement (signal-capture audit 2026-07-21 §4.4, founder ruling
 * `progress-signal-capture-v2`: baseline the system before fixing it,
 * then land every change with before-and-after numbers).
 *
 * Every case is phrasing a real parent produced or would plausibly
 * produce. Sources, so nobody has to guess later:
 *   - `prod_lesson`: clauses the synthesis model wrote from Alessa's
 *     2026-07-21 recorded lesson with Story, verbatim.
 *   - `prod_chat`: shapes taken from real family messages in
 *     conversation_messages.
 *   - `instructions`: the example sentences apps/web/agent/instructions.md
 *     uses to teach the journaling trigger. These SHOULD match by
 *     definition: Homa is told to journal exactly these, so a miss is
 *     the product contradicting its own documentation.
 *   - `audit`: phrasings the 2026-07-21 audit's failure hunt produced.
 *
 * `want` is the outcome the founder's vision requires, not what the
 * code does today. The gap between want and observed IS the measurement,
 * so cases stay here while they fail; journal-recall.test.ts holds the
 * ratchet that stops the gap from widening.
 */

export type JournalRecallWant = "scores" | "observes" | "ignores";

export interface JournalRecallCase {
  /** What the parent wrote or said. */
  quote: string;
  childName: string;
  /**
   * scores: a concrete capability report that must move a number.
   * observes: real signal with no scoreable claim (activity, context).
   * ignores: must never touch the child's record (logistics, venting,
   *   another person's child, a question rather than a report).
   */
  want: JournalRecallWant;
  /**
   * The answer tier this phrasing must record if it scores at all.
   * Recording the wrong tier is worse than recording nothing: the
   * ledger then asserts something the parent did not say. Only set on
   * cases where the phrasing pins the tier.
   */
  wantAnswer?: "easily" | "getting_there" | "not_yet";
  source: "prod_lesson" | "prod_chat" | "instructions" | "audit";
  /** Why this case exists, for whoever reads a failure later. */
  note: string;
}

export const JOURNAL_RECALL_CORPUS: readonly JournalRecallCase[] = [
  // ---- The product's own documented examples (instructions.md) ----
  {
    quote: "Maya read a whole early reader alone",
    childName: "Maya",
    want: "scores",
    source: "instructions",
    note: "The routing table's own capability example (instructions.md:156).",
  },
  {
    quote: "She finished the counting page",
    childName: "Story",
    want: "scores",
    source: "instructions",
    note: "The routing table's own completion example, pronoun subject as written there.",
  },
  {
    quote: "Jordan still can't pedal",
    childName: "Jordan",
    want: "scores",
    wantAnswer: "not_yet",
    source: "instructions",
    note: "The documented negative-capability example; must record not_yet, never mastery.",
  },
  {
    quote: "we practiced letter sounds today",
    childName: "Story",
    want: "observes",
    source: "instructions",
    note: "PR #79's day-recap broadening: activity with no attributed capability.",
  },

  // ---- Verbatim clauses from the first real recorded lesson ----
  {
    quote: "Story counted up to five with encouragement.",
    childName: "Story",
    want: "scores",
    source: "prod_lesson",
    note: "Landed as a no_match observation in prod 2026-07-21; nearest candidate math.counts-to-5 at 0.33.",
  },
  {
    quote: "Story counted one red coin correctly.",
    childName: "Story",
    want: "scores",
    source: "prod_lesson",
    note: "Prod observation 2026-07-21; a counting demonstration that should reach a counting rung.",
  },
  {
    quote:
      "Story could sound out the first letter of a word but not the whole word yet.",
    childName: "Story",
    want: "scores",
    wantAnswer: "getting_there",
    source: "prod_lesson",
    note: "Prod observation 2026-07-21; partial ability, must land getting_there rather than easily.",
  },
  {
    quote: "Story sometimes guessed at a word instead of sounding it out.",
    childName: "Story",
    want: "observes",
    source: "prod_lesson",
    note: "A struggle description with no clean rung; real signal, no score.",
  },

  // ---- Capability reports in ordinary parent phrasing ----
  {
    quote: "Maya can count to 100 now",
    childName: "Maya",
    want: "scores",
    source: "audit",
    note: "Explicit capability report, the strongest signal tier; audit measured 0.50, ambiguous.",
  },
  {
    quote: "Today Maya read her first chapter book",
    childName: "Maya",
    want: "scores",
    source: "audit",
    note: "Leading adverb before the name; also the chapter-book rung the matcher excludes.",
  },
  {
    quote: "Maya read Green Eggs and Ham all by herself",
    childName: "Maya",
    want: "scores",
    wantAnswer: "easily",
    source: "audit",
    note: "A capitalized book title must not be read as a second person.",
  },
  {
    quote: "She counted to 20 all by herself!",
    childName: "Emma",
    want: "scores",
    source: "audit",
    note: "Sentence-initial pronoun for the child the tool call already names.",
  },
  {
    quote: "Emma wrote her name without any help today",
    childName: "Emma",
    want: "scores",
    wantAnswer: "easily",
    source: "audit",
    note: "Name-led, independence stated; the shape closest to the current alias rules.",
  },
  {
    quote: "Emma counted five objects and told me how many",
    childName: "Emma",
    want: "scores",
    source: "audit",
    note: "Number word rather than digit; the alias table only carried digits before 2026-07-21.",
  },
  {
    quote: "Emma struggled to read her book tonight",
    childName: "Emma",
    want: "scores",
    wantAnswer: "getting_there",
    source: "audit",
    note: "Struggle must never record as easily; polarity, not recall.",
  },
  {
    quote: "Emma read a book with me at bedtime",
    childName: "Emma",
    want: "observes",
    wantAnswer: "getting_there",
    source: "audit",
    note: "Shared reading is not independent reading; must not claim mastery.",
  },

  // ---- Family activities and day recaps ----
  {
    quote: "We all did a 50-states scavenger hunt this afternoon",
    childName: "Story",
    want: "observes",
    source: "audit",
    note: "The founder's fan-out scenario; per-child observation, never a score.",
  },
  {
    quote: "We read for 30 minutes this morning",
    childName: "Story",
    want: "observes",
    source: "audit",
    note: "Timed activity, no attributed capability.",
  },
  {
    quote: "We did letter sounds and then Story wrote her name by herself",
    childName: "Story",
    want: "scores",
    source: "audit",
    note: "A recap containing a real capability clause; the whole message must not be discarded.",
  },

  // ---- Must never touch the record ----
  {
    quote: "Can you make me an addition worksheet for Story using paw patrol",
    childName: "Story",
    want: "ignores",
    source: "prod_chat",
    note: "Real prod message: a request, not a report.",
  },
  {
    quote: "What should we work on this week?",
    childName: "Story",
    want: "ignores",
    source: "prod_chat",
    note: "Real prod message: a question about the future.",
  },
  {
    quote: "adjust my planner week",
    childName: "Story",
    want: "ignores",
    source: "prod_chat",
    note: "Real prod message: logistics.",
  },
  {
    quote:
      "This looks awful. The images are not even coming up. Going forward before you send me anything it needs to be double checked",
    childName: "Story",
    want: "ignores",
    source: "prod_chat",
    note: "Real prod message: product feedback, never a child observation.",
  },
  {
    quote: "Her cousin Ellie read a whole chapter book at six",
    childName: "Emma",
    want: "ignores",
    source: "audit",
    note: "Another child's capability must never credit this child.",
  },
  {
    quote: "I am so tired of fighting about school every morning",
    childName: "Story",
    want: "ignores",
    source: "audit",
    note: "Venting; carries no capability claim.",
  },
];
