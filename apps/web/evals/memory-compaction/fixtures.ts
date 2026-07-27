import type { ActiveRow } from "../../lib/learning/compact-memories";

/**
 * Compaction judgment fixtures, taken verbatim from production
 * (AGENTS.md "Models judge, code verifies": measure the judgment layer
 * against real language, with fixtures from production, and ratchet the
 * number).
 *
 * Every row below is a real family_memories row as it stood on
 * 2026-07-21, before the first compaction pass. The positives are the
 * groups that pass actually merged or unpacked; the negatives are rows
 * that were left alone and MUST stay alone. Negatives matter more than
 * positives here: a missed merge costs some prompt budget, but a wrong
 * merge rewrites what Homa believes about a child.
 *
 * Names are the real children's. These are the founder's own families and
 * this file stays in the repo, so keep it to memory text already stored,
 * never transcripts or anything a parent said in confidence.
 */

export const ALMA = "11111111-1111-4111-8111-111111111111";
export const ARA = "22222222-2222-4222-8222-222222222222";
export const AMALIA = "33333333-3333-4333-8333-333333333333";
export const AXEL = "44444444-4444-4444-8444-444444444444";
export const MILA = "55555555-5555-4555-8555-555555555555";

export const CHILD_NAMES = new Map<string, string>([
  [ALMA, "Alma"],
  [ARA, "Ara"],
  [AMALIA, "Amalia"],
  [AXEL, "Axel"],
  [MILA, "Mila"],
]);

let seq = 0;
function row(
  child: string | null,
  kind: "fact" | "what_works",
  content: string,
  day = "2026-07-10",
): ActiveRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    child_id: child,
    kind,
    content,
    created_at: `${day} 12:00:00+00`,
  };
}

export interface CompactionCase {
  name: string;
  rows: ActiveRow[];
  /**
   * Row indices that must all land in ONE merge group. A larger group that
   * contains them still passes: where exactly a defensible boundary falls
   * is judgment, and pinning it to an exact partition would test the
   * model's taste rather than the product requirement. Over-merging is
   * held in check by the negative cases and by validateMerge's no-saving
   * guard, not by this field.
   */
  expectMerge?: number[];
  /** Row index that must be unpacked, and the children it must land on. */
  expectSplit?: { entry: number; children: string[] };
  /** True when the correct answer is to propose nothing at all. */
  expectNothing?: boolean;
  why: string;
}

export const CASES: CompactionCase[] = [
  {
    name: "syllable cluster: a question and the answer that resolved it",
    rows: [
      row(
        AMALIA,
        "fact",
        "When sounding out printed Spanish words, Amalia pauses between syllables (e.g., A-ma-li-a, al-ma, pa-pi, pe-rro), showing syllable segmentation during decoding, though it's not yet confirmed she can clap syllables by ear alone without print.",
        "2026-07-14",
      ),
      row(
        AMALIA,
        "fact",
        "Carolyng plans to try a no-print syllable clapping test with Amalia (say a word aloud with nothing written, see if she claps/taps the beats) once they're back together, to confirm the phonics syllable-awareness skill.",
        "2026-07-14",
      ),
      row(
        AMALIA,
        "fact",
        "Amalia is working on syllable counting with visuals in both English and Spanish.",
        "2026-07-19",
      ),
      row(
        AMALIA,
        "fact",
        "Amalia can break spoken words into syllables (e.g., sa-lute, col-lapse) but struggles to count the number of claps/beats when a word is said aloud without print in front of her.",
        "2026-07-19",
      ),
    ],
    // 0, 1 and 3 are the skill state and the stale plan that state
    // answered; those must collapse. Row 2 is the practice activity, and
    // whether it joins is a real judgment call: the production run of
    // 2026-07-21 took all four, a later run took three. Both are honest,
    // so only the three that MUST collapse are asserted.
    expectMerge: [0, 1, 3],
    why: "715 chars describing one skill, including a plan to run a test whose answer arrived five days later. The old cosine guardrail scored this pair 0.537 and missed it.",
  },
  {
    name: "same skill restated as it firmed up",
    rows: [
      row(
        AMALIA,
        "fact",
        "Amalia (age 3) knows these letters: a, b, c, d, e, f, g, h, i, l, m, o, p, r, s, t, x.",
        "2026-07-07",
      ),
      row(
        AMALIA,
        "fact",
        "Amalia (age 3) knows the letter sounds for a, b, c, d, e, f, h, i, l, m, o, p, r, s, t, x, and can read words up to five letters long in Spanish, including amp, amor, papi, mama, alma, are, Amalia, best, flor, and carta.",
        "2026-07-14",
      ),
    ],
    expectMerge: [0, 1],
    why: "The later entry strictly contains the earlier one. Note the sibling's name 'alma' appears as a Spanish word inside the reading list, which is where naive name matching corrupts data.",
  },
  {
    name: "two observations of one reading preference",
    rows: [
      row(
        ARA,
        "what_works",
        "Ara (6) prefers fast-paced, punchy stories; Stuart Little felt too slow for her. She likes quick plot movement with animals.",
      ),
      row(
        ARA,
        "what_works",
        "Mercy Watson (fast, funny pig chapter books) is a big hit with Ara; short punchy chapters work much better for her than slower classics.",
      ),
    ],
    expectMerge: [0, 1],
    why: "The guardrail DID flag this pair at 0.402, and the note changed nothing: both rows rode in every prompt for eleven days.",
  },
  {
    name: "packed row: two children's separate writing focuses",
    rows: [
      row(
        null,
        "fact",
        "For Ara's writing, Carolyng wants a focus on narration (beginning-middle-end) and writing a few sentences; for Alma, the focus is creative writing across genres, grammar, topic sentences, and paragraph structure.",
      ),
    ],
    expectSplit: { entry: 0, children: ["Ara", "Alma"] },
    why: "Two facts filed under nobody. Unfindable per child, and it sits the sisters side by side in every prompt.",
  },
  {
    name: "packed row: per-child lists under a shared heading",
    rows: [
      row(
        null,
        "fact",
        "Spanish reading picks chosen: Ara - El Superzorro, La historia de Despereaux. Alma - Las brujas, El árbol de los deseos, Agujeros, El viento en los sauces.",
      ),
    ],
    expectSplit: { entry: 0, children: ["Ara", "Alma"] },
    why: "One heading, two independent lists.",
  },
  {
    name: "NEGATIVE: a genuinely joint activity",
    rows: [
      row(
        null,
        "fact",
        "Axel and Mila are doing a 50 States unit study together, focused on six weeks by region (Northeast, Midwest, South, West, then DC/territories, then a wrap-up), with letters mailed to state and territory tourist centers each week as a fun bonus alongside the region focus.",
      ),
    ],
    expectNothing: true,
    why: "One shared activity. Splitting duplicates 270 chars and destroys the word 'together', which is the fact.",
  },
  {
    name: "NEGATIVE: a shared preference, not two facts",
    rows: [
      row(
        null,
        "fact",
        "Both Ara and Alma prefer standalone Spanish books over series, and both love The Nocturnals and The Creature Cases.",
      ),
    ],
    expectNothing: true,
    why: "Both halves would say the same sentence with a different name. The growth guard refuses this at 1.71x even if proposed.",
  },
  {
    name: "NEGATIVE: a parent-level fact mentioning the kids",
    rows: [
      row(
        null,
        "fact",
        "Carolyng wants to keep Spanish and English reading materials separate for her kids rather than using bilingual books.",
      ),
    ],
    expectNothing: true,
    why: "A household rule, not a per-child fact. Also the row where substring matching finds 'ara' inside 'separate'.",
  },
  {
    name: "NEGATIVE: two unrelated facts about one child",
    rows: [
      row(
        ALMA,
        "fact",
        "Alma uses the Rocket Math app for multiplication practice; a 2-week break from it lowered her math confidence.",
      ),
      row(
        ALMA,
        "fact",
        "Alma is an advanced reader who has read Wonder, A Wrinkle in Time, the Wild Robot series, The Hobbit, and My Side of the Mountain; she loves animals, magic, dragons, and forest/nature settings.",
      ),
    ],
    expectNothing: true,
    why: "Same child, same kind, entirely different subjects. Merging would invent a relationship between math confidence and reading taste.",
  },
  {
    name: "NEGATIVE: two children's parallel facts must never merge",
    rows: [
      row(ALMA, "fact", "Alma is an advanced reader working through The Hobbit."),
      row(ARA, "fact", "Ara is working through beginner-to-early chapter books."),
    ],
    expectNothing: true,
    why: "The multi-kid law. validateMerge refuses cross-child regardless, so this measures whether the model even proposes it.",
  },
  {
    name: "NEGATIVE: a fact and a what_works stay separate kinds",
    rows: [
      row(ALMA, "fact", "Alma is practising multiplication facts daily in Rocket Math."),
      row(
        ALMA,
        "what_works",
        "Self-timed \"beat your own record\" framing (no countdown, no comparison to others) works better than a strict timer for building Alma's math fact fluency without spiking her anxiety.",
      ),
    ],
    expectNothing: true,
    why: "A thing that is true and an approach that lands are different kinds.",
  },
];
