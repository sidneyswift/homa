/**
 * The map content bank, v2026.07.3: ages 2 to 16 (scored), 16 domains.
 *
 * Provenance: ported and extended from homa-template's questionnaire bank
 * (workspace/questionnaire/domains.json) and its citation-backed benchmark
 * library (workspace/benchmarks/*.md, PreK through grade 12), then
 * re-verified and deepened against the national benchmark corpus at
 * docs/homa-benchmarks/ (2026-07-06 research pass; see its 00-synthesis.md
 * for the corrections v2026.07.2 applied). Every item's typicalMonths is
 * the age in months by which the behavior is typical per the cited
 * frameworks; the scorer reads months-ahead off these anchors, crediting
 * the early edge of typicalRangeMonths where one is documented (v2026.07.3
 * accuracy pass, after pilot parents flagged inflated claims: anchors are
 * "typical BY" ages, the late edge of wide normal windows, per lane 11 of
 * the corpus).
 * Upper anchors map school bands to ages: gr 3 ~9y (108mo), gr 5 ~11y
 * (132mo), gr 8 ~14y (168mo), gr 10 ~16y (192mo), with ladder headroom to
 * ~17y for detecting ahead at the top of the range.
 *
 * Content laws (enforced by scripts/map-check.mts):
 *   1. Statements are parent-observable, answerable from memory tonight.
 *   2. Banned words never appear: behind, delay, disorder, diagnose,
 *      screening, assessment, percentile. No em dash character, ever.
 *   3. Every item cites at least one source key.
 */

export interface MapItemContent {
  id: string;
  statement: string;
  typicalMonths: number;
  sources: readonly string[];
  /**
   * Formal standard codes behind the anchor (for example "CCSS K.OA.A.4",
   * "NGSS 5-LS2-1", "CSTA 1B-AP-09", "ELOF P-LIT 3"), populated only where
   * a code was verified in docs/homa-benchmarks/. Makes re-verification
   * mechanical when a standards body revises. Absent means the anchor rests
   * on research or framework guidance without a citable code.
   */
  standards?: readonly string[];
  /**
   * The typical WINDOW [earliest, latest] in months, populated only where
   * the corpus documents a real range (docs/homa-benchmarks/00-synthesis.md
   * corrections: single-anchor displays understate normal spread). The
   * report renders a band instead of a single dot when present; scoring
   * never reads it (anchors stay the scoring truth).
   */
  typicalRangeMonths?: readonly [number, number];
}

export interface MapSubjectContent {
  id: string;
  displayName: string;
  intro: string;
  /** 1 to 2 plain sentences a parent reads when a subject card opens:
   * what this subject IS and what it feeds, in layman's terms. Written
   * age-neutrally so one line serves ages 2 to 16 (report simplification
   * pass, 2026-07-08). Linted by scripts/map-check.mts like every other
   * parent-facing bank string. */
  whatItIs: string;
  exposureBased: boolean;
  growingActivity: { title: string; description: string };
  /** Age-appropriate swap for kids ~8 and up (the report picks by age). */
  growingActivityOlder?: { title: string; description: string };
  items: readonly MapItemContent[];
}

/** The ages CDC publishes a milestone checklist page for, in months. */
const CDC_CHECKLIST_MONTHS = [2, 4, 6, 9, 12, 15, 18, 24, 30, 36, 48, 60] as const;

/**
 * The CDC checklist page nearest the child's age (read-through ask:
 * link the exact page, "show me where you got this," not the index).
 * Picks the highest checkpoint the child has reached; clamps to 2mo-5yr.
 */
export function cdcChecklistUrl(ageMonths: number): string {
  let picked: number = CDC_CHECKLIST_MONTHS[0];
  for (const checkpoint of CDC_CHECKLIST_MONTHS) {
    if (checkpoint <= ageMonths) picked = checkpoint;
  }
  const slug = picked < 12 ? `${picked}mo` : picked % 12 === 0 ? `${picked / 12}yr` : `${picked}mo`;
  return `https://www.cdc.gov/act-early/milestones/milestones-${slug}.html`;
}

/** Citation registry: every item's `sources` keys resolve here. */
export const MAP_SOURCES: Record<string, { label: string; url: string }> = {
  cdc: {
    label: "CDC, Learn the Signs. Act Early. milestone checklists (2022 revision)",
    url: "https://www.cdc.gov/act-early/milestones/index.html",
  },
  elof: {
    label: "Head Start Early Learning Outcomes Framework (ELOF), ages 3 to 5",
    url: "https://headstart.gov/interactive-head-start-early-learning-outcomes-framework-ages-birth-five",
  },
  "ccss-ela": {
    label: "Common Core State Standards, English Language Arts (incl. Reading Foundational Skills)",
    url: "https://www.thecorestandards.org/ELA-Literacy/",
  },
  "ccss-math": {
    label: "Common Core State Standards, Mathematics",
    url: "https://www.thecorestandards.org/Math/",
  },
  ngss: {
    label: "Next Generation Science Standards, K to 2 performance expectations",
    url: "https://www.nextgenscience.org/",
  },
  c3: {
    label: "NCSS C3 Framework for Social Studies + Core Knowledge Sequence (PreK to 2)",
    url: "https://www.socialstudies.org/standards/c3",
  },
  nca: {
    label: "National Core Arts Standards (incl. NAfME music standards)",
    url: "https://www.nationalartsstandards.org/",
  },
  shape: {
    label: "SHAPE America national PE standards + pediatric motor milestone references",
    url: "https://www.shapeamerica.org/standards/pe/",
  },
  casel: {
    label: "CASEL five social-emotional competencies + state SEL standards",
    url: "https://casel.org/fundamentals-of-sel/",
  },
  actfl: {
    label: "ACTFL proficiency guidelines, novice range",
    url: "https://www.actfl.org/educator-resources/actfl-proficiency-guidelines",
  },
  "harvard-ef": {
    label: "Harvard Center on the Developing Child, executive function milestones",
    url: "https://developingchild.harvard.edu/science/key-concepts/executive-function/",
  },
  "clements-sarama": {
    label: "Clements & Sarama, early mathematics learning trajectories",
    url: "https://www.learningtrajectories.org/",
  },
  hwt: {
    label: "Handwriting Without Tears / Zaner-Bloser handwriting + keyboarding progressions",
    url: "https://www.lwtears.com/hwt",
  },
  "dawson-guare": {
    label: "Dawson & Guare, Smart but Scattered executive skills progressions",
    url: "https://www.smartbutscatteredkids.com/",
  },
  "aap-lifeskills": {
    label: "American Academy of Pediatrics (HealthyChildren.org) chores + independence guidance",
    url: "https://www.healthychildren.org/English/family-life/family-dynamics/communication-discipline/Pages/Chores-and-Responsibility.aspx",
  },
  asha: {
    label: "ASHA school-age speech and language milestones",
    url: "https://www.asha.org/public/speech/development/",
  },
  hustad: {
    label: "Hustad et al. 2021 (JSLHR), objective intelligibility growth, ages 30 to 119 months",
    url: "https://pubs.asha.org/doi/10.1044/2021_JSLHR-21-00142",
  },
  "crowe-mcleod": {
    label: "Crowe & McLeod 2020 (AJSLP), US English consonant acquisition review",
    url: "https://pubs.asha.org/doi/10.1044/2020_AJSLP-19-00168",
  },
  wellman: {
    label: "Wellman, Cross & Watson 2001, theory-of-mind (false belief) meta-analysis",
    url: "https://doi.org/10.1111/1467-8624.00304",
  },
  lowenfeld: {
    label: "Lowenfeld, Creative and Mental Growth, drawing development stages",
    url: "https://archive.org/details/creativementalgr00",
  },
  ufli: {
    label: "UFLI Foundations scope and sequence (University of Florida Literacy Institute)",
    url: "https://ufli.education.ufl.edu/foundations/",
  },
  cee: {
    label: "Council for Economic Education + Jump$tart national economics and personal finance standards",
    url: "https://www.councilforeconed.org/policy-advocacy/k-12-standards/",
  },
  "hoff-core": {
    label: "Hoff & Core 2015, bilingual development in early childhood",
    url: "https://www.thieme-connect.com/products/ejournals/html/10.1055/s-0035-1549104",
  },
  csta: {
    label: "CSTA K-12 Computer Science Standards (2017 revision; 2026 update tracked)",
    url: "https://csteachers.org/k12standards/",
  },
  applebee: {
    label: "Applebee, The Child's Concept of Story, narrative development stages",
    url: "https://archive.org/details/childsconceptofs0000appl_i5o9",
  },
};

export const MAP_SUBJECTS: readonly MapSubjectContent[] = [
  {
    id: "math",
    displayName: "Math",
    intro: "First up: numbers.",
    whatItIs:
      "Math is number sense: what numbers mean, how amounts compare, and how patterns work. Each skill stacks on the last, from counting to fractions to algebra.",
    exposureBased: false,
    growingActivity: {
      title: "Count the stairs",
      description:
        "Count everything today: stairs, crackers, toy cars. Touch each one as you count, and go one higher than yesterday.",
    },
    growingActivityOlder: {
      title: "Real-money math",
      description:
        "Hand them the real math: the grocery total, the tip, the discount. Real stakes beat worksheets.",
    },
    items: [
      { id: "math.counts-to-5", statement: "Counts out loud from 1 to 5, mostly in order", typicalMonths: 30, sources: ["elof", "clements-sarama"], standards: ["ELOF P-MATH 1"] },
      // Range: Clements and Sarama's Small Collection Namer level runs 34
      // to 39 months (corpus lane 01 porting notes).
      { id: "math.small-groups", statement: "Tells you how many things are in a small group of 1 to 3 without counting them", typicalMonths: 36, typicalRangeMonths: [34, 39], sources: ["clements-sarama"] },
      { id: "math.counts-to-10", statement: "Counts out loud to 10 without skipping numbers", typicalMonths: 42, sources: ["elof", "clements-sarama"], standards: ["ELOF P-MATH 1"] },
      { id: "math.how-many-5", statement: "Counts 5 objects one at a time and tells you how many there are", typicalMonths: 48, sources: ["elof", "cdc"] },
      { id: "math.counts-past-20", statement: "Counts past 20 without getting stuck", typicalMonths: 54, sources: ["elof", "ccss-math"], standards: ["ELOF P-MATH 1"] },
      { id: "math.adds-with-objects", statement: "Figures out 2 cookies plus 1 more, using objects or fingers", typicalMonths: 60, sources: ["elof", "clements-sarama"], standards: ["ELOF P-MATH 6"] },
      { id: "math.makes-10", statement: "Finds the number that makes 10 (7 needs 3 more)", typicalMonths: 72, sources: ["ccss-math"], standards: ["CCSS K.OA.A.4"] },
      // Range: CCSS places it end of K (72mo); Clements and Sarama's
      // trajectories put typical mastery nearer 84mo (00-synthesis §3.3).
      { id: "math.counts-to-100", statement: "Counts to 100, by ones or by tens", typicalMonths: 78, typicalRangeMonths: [72, 84], sources: ["ccss-math", "clements-sarama"], standards: ["CCSS K.CC.A.1"] },
      { id: "math.mental-add-10", statement: "Adds and subtracts small numbers in their head, like 7 plus 2", typicalMonths: 84, sources: ["ccss-math"], standards: ["CCSS 1.OA.C.6"] },
      { id: "math.derived-facts", statement: "Uses facts they know to crack new ones (7+7 helps with 7+8)", typicalMonths: 92, sources: ["clements-sarama", "ccss-math"], standards: ["CCSS 1.OA.C.6"] },
      { id: "math.skip-counting", statement: "Skip-counts by 5s, 10s, and 100s, and reads 3-digit numbers", typicalMonths: 96, sources: ["ccss-math"], standards: ["CCSS 2.NBT.A.2", "CCSS 2.NBT.A.3"] },
      { id: "math.times-tables", statement: "Knows multiplication facts through 10 from memory", typicalMonths: 110, sources: ["ccss-math"], standards: ["CCSS 3.OA.C.7"] },
      { id: "math.long-multiply", statement: "Multiplies multi-digit numbers and divides with remainders on paper", typicalMonths: 126, sources: ["ccss-math"], standards: ["CCSS 4.NBT.B.5", "CCSS 4.NBT.B.6"] },
      { id: "math.fractions-decimals", statement: "Adds, subtracts, and compares fractions and decimals comfortably", typicalMonths: 140, sources: ["ccss-math"], standards: ["CCSS 5.NF.A.1"] },
      { id: "math.ratios-percents", statement: "Works with ratios, percents, and negative numbers", typicalMonths: 152, sources: ["ccss-math"], standards: ["CCSS 6.RP.A.3", "CCSS 6.NS.C.5"] },
      { id: "math.solves-equations", statement: "Solves multi-step equations with a variable, like 3x + 4 = 19", typicalMonths: 170, sources: ["ccss-math"], standards: ["CCSS 7.EE.B.4"] },
      { id: "math.algebra-functions", statement: "Handles algebra comfortably: graphs a line, works with functions", typicalMonths: 190, sources: ["ccss-math"] },
      { id: "math.advanced-tools", statement: "Uses quadratics or right-triangle trig to solve real problems", typicalMonths: 204, sources: ["ccss-math"], standards: ["CCSS HS.A-REI.B.4", "CCSS HS.G-SRT.C.8"] },
    ],
  },
  {
    id: "literacy",
    displayName: "Literacy",
    intro: "Next: books and reading.",
    whatItIs:
      "Literacy is the road to reading: enjoying books, learning how print works, then reading and understanding on their own. It feeds every other subject, because so much learning arrives through reading.",
    exposureBased: false,
    growingActivity: {
      title: "The letter hunt",
      description:
        "Pick one letter for the day and hunt it everywhere: cereal boxes, street signs, book covers. Celebrate every find.",
    },
    growingActivityOlder: {
      title: "The book they pick",
      description:
        "Twenty minutes with any book they chose, then one question: what happens next, and why?",
    },
    items: [
      { id: "literacy.book-handling", statement: "Turns book pages and points at pictures when you name them", typicalMonths: 30, sources: ["cdc", "elof"] },
      // Range: ASHA places pretend reading in the 3-to-4-year band
      // (corpus lane 01 porting notes).
      { id: "literacy.pretend-reads", statement: "Pretends to read a favorite book out loud, turning the pages", typicalMonths: 40, typicalRangeMonths: [36, 48], sources: ["asha", "elof"] },
      { id: "literacy.own-name-letters", statement: "Recognizes the letters in their own name", typicalMonths: 42, sources: ["elof"], standards: ["ELOF P-LIT 3"] },
      // Range: ELOF P-LIT 2 places knowing print carries meaning in the
      // 36-to-48-month progression (corpus lane 01 porting notes).
      { id: "literacy.print-meaning", statement: "Asks what written words say, like a sign or a cereal box", typicalMonths: 48, typicalRangeMonths: [36, 48], sources: ["elof"], standards: ["ELOF P-LIT 2"] },
      { id: "literacy.uppercase-half", statement: "Names more than half of the uppercase letters", typicalMonths: 52, sources: ["elof"], standards: ["ELOF P-LIT 3"] },
      { id: "literacy.retells-story", statement: "Retells a story you just read: what happened first, and how it ended", typicalMonths: 60, sources: ["cdc", "elof"], standards: ["ELOF P-LIT 4"] },
      { id: "literacy.sight-words", statement: "Reads their own name and a few familiar words on sight (like STOP)", typicalMonths: 64, sources: ["elof", "ccss-ela"], standards: ["CCSS RF.K.3.c"] },
      { id: "literacy.emergent-reader", statement: "Reads a very simple book (a line or two per page) mostly on their own", typicalMonths: 72, sources: ["ccss-ela"], standards: ["CCSS RF.K.4"] },
      { id: "literacy.reads-short-book", statement: "Reads a short book out loud and tells you about it after", typicalMonths: 84, sources: ["ccss-ela"], standards: ["CCSS RF.1.4"] },
      { id: "literacy.chapter-books", statement: "Reads early chapter books and retells the plot", typicalMonths: 96, sources: ["ccss-ela"], standards: ["CCSS RL.2.10"] },
      { id: "literacy.novels", statement: "Reads a novel on their own and follows the plot across chapters", typicalMonths: 110, sources: ["ccss-ela"], standards: ["CCSS RL.3.10"] },
      { id: "literacy.main-idea-evidence", statement: "Explains the main idea of an article and backs it up with details from the text", typicalMonths: 128, sources: ["ccss-ela"], standards: ["CCSS RI.4.2"] },
      { id: "literacy.theme-evidence", statement: "Talks about a book's theme and points to evidence for it", typicalMonths: 146, sources: ["ccss-ela"], standards: ["CCSS RL.6.1", "CCSS RL.6.2"] },
      { id: "literacy.judges-arguments", statement: "Reads an argument and judges whether the evidence really supports it", typicalMonths: 164, sources: ["ccss-ela"], standards: ["CCSS RI.8.8"] },
      { id: "literacy.dense-texts", statement: "Reads dense material (history, science, literature) and discusses it critically", typicalMonths: 184, sources: ["ccss-ela"], standards: ["CCSS RI.9-10.10"] },
      { id: "literacy.interpretations", statement: "Compares different interpretations of a text and defends their own reading", typicalMonths: 202, sources: ["ccss-ela"], standards: ["CCSS RL.11-12.7"] },
    ],
  },
  {
    id: "phonics",
    displayName: "Phonics",
    intro: "Sounds, rhymes, and sounding out words.",
    whatItIs:
      "Phonics is hearing the sounds inside words: rhymes, first sounds, then sounding out print. It is what makes reading and spelling new words possible.",
    exposureBased: false,
    growingActivity: {
      title: "Sound I-spy",
      description:
        "Play I-spy with sounds: 'I spy something that starts with mmm.' Works in the car, the bath, the grocery line.",
    },
    growingActivityOlder: {
      title: "Word autopsy",
      description:
        "Pick one big word from the day (photosynthesis, ridiculous) and take it apart: roots, prefixes, where it came from.",
    },
    items: [
      { id: "phonics.joins-rhymes", statement: "Joins in on rhymes and rhyming songs they know", typicalMonths: 36, sources: ["elof"], standards: ["ELOF P-LIT 1"] },
      { id: "phonics.claps-syllables", statement: "Claps the beats in a word, like ba-na-na", typicalMonths: 48, sources: ["elof", "ccss-ela"], standards: ["ELOF P-LIT 1", "CCSS RF.K.2.b"] },
      { id: "phonics.judges-rhyme", statement: "Tells you whether two words rhyme (cat, hat)", typicalMonths: 54, sources: ["elof", "ccss-ela"], standards: ["ELOF P-LIT 1", "CCSS RF.K.2.a"] },
      { id: "phonics.first-sound", statement: "Says the first sound in a spoken word (mmm for milk)", typicalMonths: 58, sources: ["elof"], standards: ["ELOF P-LIT 1"] },
      { id: "phonics.letter-sounds-10", statement: "Knows the sounds for 10 or more letters (the sound, not the name)", typicalMonths: 60, sources: ["elof", "ccss-ela"], standards: ["ELOF P-LIT 3"] },
      { id: "phonics.blends-cvc", statement: "Blends sounds you stretch out into a word: c-a-t makes cat", typicalMonths: 64, sources: ["ccss-ela"], standards: ["CCSS RF.K.2.c"] },
      { id: "phonics.decodes-cvc", statement: "Sounds out simple 3-letter words from print on their own", typicalMonths: 72, sources: ["ccss-ela"], standards: ["CCSS RF.K.3"] },
      { id: "phonics.digraphs-cvce", statement: "Reads words with sh, ch, th, and silent-e words like cake", typicalMonths: 84, sources: ["ccss-ela", "ufli"], standards: ["CCSS RF.1.3"] },
      { id: "phonics.vowel-teams", statement: "Reads words with vowel teams (boat, rain) and r-controlled vowels (farm, bird)", typicalMonths: 90, sources: ["ufli", "ccss-ela"], standards: ["CCSS RF.1.3", "CCSS RF.2.3.b"] },
      { id: "phonics.two-syllable", statement: "Reads two-syllable words by chunking them (rab-bit)", typicalMonths: 96, sources: ["ccss-ela"], standards: ["CCSS RF.2.3.c"] },
      { id: "phonics.multisyllable", statement: "Sounds out long unfamiliar words by chunking syllables (fantastic, remembering)", typicalMonths: 112, sources: ["ccss-ela"], standards: ["CCSS RF.3.3.c"] },
      { id: "phonics.roots-prefixes", statement: "Uses roots and prefixes to figure out new words (bi-cycle, pre-view)", typicalMonths: 130, sources: ["ccss-ela"], standards: ["CCSS RF.3.3.a", "CCSS RF.4.3.a"] },
      { id: "phonics.fluent-expression", statement: "Reads aloud smoothly with expression, self-correcting when something sounds off", typicalMonths: 150, sources: ["ccss-ela"], standards: ["CCSS RF.5.4"] },
      { id: "phonics.technical-words", statement: "Reads technical words in science or history without stumbling (photosynthesis, constitution)", typicalMonths: 172, sources: ["ccss-ela"] },
    ],
  },
  {
    id: "writing",
    displayName: "Writing",
    intro: "Writing, from scribbles to sentences.",
    whatItIs:
      "Writing is getting thoughts onto paper: scribbles, then letters, then sentences and stories. It uses hand control and language at the same time, so it often comes together a little after reading.",
    exposureBased: false,
    growingActivity: {
      title: "Rainbow name",
      description:
        "Write their name big in marker. They trace it in two more colors, then decorate it. Name practice that feels like art.",
    },
    growingActivityOlder: {
      title: "The two-draft trick",
      description:
        "One paragraph tonight on anything they care about. Tomorrow, ten minutes making it better. Revising IS the skill.",
    },
    items: [
      { id: "writing.purposeful-marks", statement: "Scribbles on purpose and copies a straight line after you draw one", typicalMonths: 30, sources: ["cdc", "hwt"] },
      { id: "writing.draws-circle", statement: "Draws a circle on their own (not traced)", typicalMonths: 40, sources: ["cdc", "hwt"] },
      { id: "writing.finger-grip", statement: "Holds a crayon with their fingers, not a fist", typicalMonths: 48, sources: ["hwt", "cdc"] },
      { id: "writing.draws-person", statement: "Draws a person with a head, body, arms, and legs", typicalMonths: 56, sources: ["cdc", "elof"] },
      { id: "writing.writes-name", statement: "Writes their own first name so you can read it", typicalMonths: 62, sources: ["elof", "hwt"], standards: ["ELOF P-LIT 6"] },
      { id: "writing.most-letters", statement: "Writes most letters of the alphabet from memory", typicalMonths: 72, sources: ["hwt", "ccss-ela"], standards: ["CCSS L.K.1.a"] },
      { id: "writing.readable-sentence", statement: "Writes a readable sentence with spaces between the words", typicalMonths: 84, sources: ["ccss-ela", "hwt"], standards: ["CCSS L.1.2"] },
      { id: "writing.several-sentences", statement: "Writes a few sentences in a row, neat enough for anyone to read", typicalMonths: 96, sources: ["ccss-ela", "hwt"] },
      { id: "writing.paragraph", statement: "Writes a paragraph with a beginning, middle, and end, mostly punctuated right", typicalMonths: 112, sources: ["ccss-ela"], standards: ["CCSS W.3.2", "CCSS L.3.2"] },
      { id: "writing.multi-paragraph", statement: "Writes a page or more that stays organized: a story, a report, a letter", typicalMonths: 130, sources: ["ccss-ela", "hwt"], standards: ["CCSS W.4.2"] },
      { id: "writing.typing", statement: "Types comfortably, a full page in one sitting", typicalMonths: 144, sources: ["ccss-ela", "hwt"], standards: ["CCSS W.4.6"] },
      { id: "writing.essay-evidence", statement: "Writes an essay that makes a claim and supports it with evidence", typicalMonths: 162, sources: ["ccss-ela"], standards: ["CCSS W.6.1"] },
      { id: "writing.revises-drafts", statement: "Drafts, revises, and polishes longer pieces without being walked through it", typicalMonths: 182, sources: ["ccss-ela"], standards: ["CCSS W.8.5"] },
      { id: "writing.research-paper", statement: "Writes a research paper drawing on several sources, cited", typicalMonths: 200, sources: ["ccss-ela"], standards: ["CCSS W.9-10.7"] },
    ],
  },
  {
    id: "language",
    displayName: "Language",
    intro: "Talking and telling stories.",
    whatItIs:
      "Language is talking and understanding: words, sentences, questions, and telling you what happened. It carries friendships, feelings, and every subject that gets talked through out loud.",
    exposureBased: false,
    growingActivity: {
      title: "Tell it back",
      description:
        "After anything fun, hand them the story: 'tell daddy what happened at the park.' They narrate, you add the oohs.",
    },
    growingActivityOlder: {
      title: "Dinner-table talk",
      description:
        "Two minutes on a topic they love, no notes, then one follow-up question. Holding the room is a skill you can practice.",
    },
    items: [
      { id: "language.two-words", statement: "Puts two words together, like 'more milk' or 'go park'", typicalMonths: 26, sources: ["cdc"] },
      // Range: Hustad 2021, multiword 50% intelligibility: median child at
      // 34mo, 5th percentile at 46 (corpus lane 11 §8b).
      { id: "language.short-sentences", statement: "Speaks in short sentences that family and familiar people understand", typicalMonths: 38, typicalRangeMonths: [34, 46], sources: ["hustad", "cdc", "elof"] },
      // Range: Hustad 2021 medians, 50% multiword intelligibility to
      // strangers at 34mo, 75% at 46, 90% at 62 (00-synthesis §3.2).
      { id: "language.stranger-clear", statement: "Someone who just met them understands most of what they say", typicalMonths: 46, typicalRangeMonths: [34, 62], sources: ["hustad", "cdc"] },
      { id: "language.tells-about-day", statement: "Tells you about something that happened earlier today", typicalMonths: 48, sources: ["cdc", "elof"] },
      { id: "language.why-how", statement: "Asks why and how questions, and stays on topic when you answer", typicalMonths: 54, sources: ["cdc", "elof"] },
      { id: "language.whole-story", statement: "Tells a whole little story with a beginning and an end", typicalMonths: 60, sources: ["cdc"] },
      // Range: Hustad 2021, multiword 90% intelligibility: median child at
      // 62mo, 5th percentile at 87 (corpus lane 11 §8b).
      { id: "language.clear-sounds", statement: "Says nearly all speech sounds clearly (r and th often come last)", typicalMonths: 62, typicalRangeMonths: [62, 87], sources: ["crowe-mcleod", "hustad", "asha"] },
      { id: "language.tenses", statement: "Uses past and future naturally ('we went', 'we're going to')", typicalMonths: 68, sources: ["cdc", "elof"] },
      { id: "language.true-story", statement: "Tells a true story from their life with a beginning, a problem, and how it turned out", typicalMonths: 72, sources: ["applebee"] },
      { id: "language.explains-steps", statement: "Explains how to do something step by step, like the rules of a game", typicalMonths: 84, sources: ["ccss-ela"], standards: ["CCSS SL.1.4"] },
      { id: "language.real-conversation", statement: "Holds a real back-and-forth conversation with an adult, adding their own ideas", typicalMonths: 96, sources: ["ccss-ela"], standards: ["CCSS SL.2.1"] },
      { id: "language.retells-organized", statement: "Recounts something they learned in an organized way, with the details that matter", typicalMonths: 112, sources: ["asha", "ccss-ela"], standards: ["CCSS SL.3.4"] },
      { id: "language.figurative", statement: "Gets and uses figurative language ('this room is a zoo')", typicalMonths: 126, sources: ["asha", "ccss-ela"], standards: ["CCSS L.4.5"] },
      { id: "language.debates-fairly", statement: "Discusses a disagreement with reasons, and actually responds to the other side's point", typicalMonths: 148, sources: ["ccss-ela"], standards: ["CCSS SL.6.1"] },
      { id: "language.adapts-audience", statement: "Shifts how they speak for the audience: grandma, a coach, a little cousin", typicalMonths: 164, sources: ["ccss-ela", "asha"], standards: ["CCSS SL.7.6"] },
      { id: "language.presents", statement: "Presents to a group with a clear point and holds the room", typicalMonths: 186, sources: ["ccss-ela"], standards: ["CCSS SL.9-10.4"] },
      { id: "language.persuades", statement: "Makes a persuasive case out loud, anticipating what the other side will say", typicalMonths: 202, sources: ["ccss-ela"] },
    ],
  },
  {
    id: "science",
    displayName: "Science",
    intro: "Science: noticing and finding out.",
    whatItIs:
      "Science is noticing and finding out: asking why, guessing what will happen, and checking. It builds the habit of looking closely at the world and wondering how it works.",
    exposureBased: false,
    growingActivity: {
      title: "Sink or float",
      description:
        "Fill a bowl, gather five small things, and guess before each one goes in. The guessing is the science.",
    },
    growingActivityOlder: {
      title: "Change one thing",
      description:
        "Next recipe or project, change one thing and predict what happens. That's the scientific method, at home.",
    },
    items: [
      { id: "science.notices-nature", statement: "Notices bugs, weather, and animals and points them out to you", typicalMonths: 30, sources: ["elof"], standards: ["ELOF P-SCI 1"] },
      { id: "science.sorts-groups", statement: "Sorts things into groups: big vs small, animals vs plants", typicalMonths: 44, sources: ["elof", "ngss"], standards: ["ELOF P-SCI 3"] },
      { id: "science.predicts", statement: "Makes little predictions, like 'I think it will sink!'", typicalMonths: 52, sources: ["elof", "ngss"], standards: ["ELOF P-SCI 4"] },
      { id: "science.grow-change", statement: "Knows living things grow and change: seed to plant, caterpillar to butterfly", typicalMonths: 58, sources: ["elof", "ngss"] },
      { id: "science.explains-because", statement: "Explains what happened in their own words after trying something ('it melted because...')", typicalMonths: 68, sources: ["elof", "ngss"], standards: ["ELOF P-SCI 6"] },
      { id: "science.survival-needs", statement: "Tells you what plants and animals need to survive", typicalMonths: 74, sources: ["ngss"], standards: ["NGSS K-LS1-1"] },
      { id: "science.fair-question", statement: "Comes up with a question you can actually try out, changing just one thing", typicalMonths: 88, sources: ["ngss"] },
      { id: "science.reversible", statement: "Explains which changes can be undone (ice melts and refreezes) and which cannot (cooking an egg)", typicalMonths: 98, sources: ["ngss"], standards: ["NGSS 2-PS1-4"] },
      { id: "science.records-data", statement: "Runs a fair test and records results in a chart or graph", typicalMonths: 116, sources: ["ngss"] },
      { id: "science.food-webs", statement: "Explains how energy moves through a food web, and what happens when a link breaks", typicalMonths: 132, sources: ["ngss"], standards: ["NGSS 5-LS2-1"] },
      { id: "science.models-systems", statement: "Uses a drawing or model to explain how something works, like the water cycle", typicalMonths: 144, sources: ["ngss"], standards: ["NGSS MS-ESS2-4"] },
      { id: "science.cells-systems", statement: "Explains cells, body systems, or chemical reactions in their own words", typicalMonths: 156, sources: ["ngss"], standards: ["NGSS MS-LS1-1"] },
      { id: "science.evaluates-claims", statement: "Questions a science claim they hear online: what's the evidence, what's the source", typicalMonths: 172, sources: ["ngss"] },
      { id: "science.quantitative", statement: "Works with science quantitatively: balancing equations, computing forces, reading data critically", typicalMonths: 196, sources: ["ngss"] },
    ],
  },
  {
    id: "social_studies",
    displayName: "Social studies",
    intro: "Their world: people, places, the past.",
    whatItIs:
      "Social studies is their sense of people and place: family, community, maps, and the past. It grows from knowing who is in the family into history, geography, and how the world fits together.",
    exposureBased: false,
    growingActivity: {
      title: "Map of home",
      description:
        "Draw a map of your house together and mark everyone's bed with a star. Their first map and first legend, zero prep.",
    },
    growingActivityOlder: {
      title: "One story, two tellings",
      description:
        "Read the same news story from two sources and hunt the differences together. That's source-reading.",
    },
    items: [
      { id: "social_studies.name-age", statement: "Says their first name and age when someone asks", typicalMonths: 33, sources: ["cdc", "elof"] },
      { id: "social_studies.family-roles", statement: "Names family members and how they connect (grandma is mommy's mom)", typicalMonths: 46, sources: ["elof", "c3"] },
      { id: "social_studies.helpers", statement: "Knows what community helpers do: firefighter, doctor, mail carrier", typicalMonths: 54, sources: ["elof", "c3"] },
      { id: "social_studies.place-words", statement: "Uses place words (near, far, on top of) and knows the name of their town", typicalMonths: 60, sources: ["elof", "c3"] },
      { id: "social_studies.time-order", statement: "Puts family events in order: before and after, yesterday and tomorrow", typicalMonths: 68, sources: ["elof", "c3"] },
      { id: "social_studies.maps-real", statement: "Finds land and water on a map or globe and knows maps show real places", typicalMonths: 78, sources: ["c3"], standards: ["C3 D2.Geo.1.K-2"] },
      { id: "social_studies.city-state", statement: "Names their city, state, and country", typicalMonths: 90, sources: ["c3"] },
      { id: "social_studies.money-basics", statement: "Explains what money does: earning, spending, and saving up", typicalMonths: 100, sources: ["c3", "cee"], standards: ["CEE 2010 Standard 1, grade 4"] },
      { id: "social_studies.continents-oceans", statement: "Names the seven continents and five oceans, and finds them on a globe", typicalMonths: 108, sources: ["c3"] },
      { id: "social_studies.timelines", statement: "Reads a timeline and explains what caused a historical event", typicalMonths: 118, sources: ["c3"], standards: ["C3 D2.His.1.3-5"] },
      { id: "social_studies.savings-plan", statement: "Makes a savings plan for something they want, and mostly sticks to it", typicalMonths: 122, sources: ["cee"], standards: ["CEE/Jump$tart 2021 Saving 4-1"] },
      { id: "social_studies.maps-scale", statement: "Uses real maps: finds states and countries, reads a map key and scale", typicalMonths: 130, sources: ["c3"], standards: ["C3 D2.Geo.3.3-5"] },
      { id: "social_studies.government-branches", statement: "Explains how laws get made and what the branches of government do", typicalMonths: 150, sources: ["c3"], standards: ["C3 D2.Civ.4.6-8"] },
      { id: "social_studies.sources-bias", statement: "Asks who wrote a source and why, and notices point of view or bias", typicalMonths: 168, sources: ["c3"], standards: ["C3 D3.2.6-8"] },
      { id: "social_studies.current-events", statement: "Follows a current event and can explain more than one side of it", typicalMonths: 186, sources: ["c3"] },
      { id: "social_studies.civic-argument", statement: "Builds an evidence-based argument about a historical or civic question", typicalMonths: 202, sources: ["c3"], standards: ["C3 D4.1.9-12"] },
    ],
  },
  {
    id: "art",
    displayName: "Art & creative",
    intro: "Art: making things their way.",
    whatItIs:
      "Art is making things their own way: drawing, painting, building, pretending. It works small-hand control and imagination at the same time, and it is often where kids first show you what is on their mind.",
    exposureBased: false,
    growingActivity: {
      title: "Draw the song",
      description:
        "Play one song and draw how it feels: fast scribbles for fast parts, soft colors for quiet parts. No wrong answers.",
    },
    growingActivityOlder: {
      title: "Draw what's there",
      description:
        "Ten minutes drawing a real object: shoes, a mug, a hand. Realism comes from observation.",
    },
    items: [
      { id: "art.happy-making", statement: "Makes marks, paints, or glues happily (the doing matters more than the result)", typicalMonths: 30, sources: ["nca", "elof"] },
      { id: "art.tadpole-person", statement: "Draws a person as a head with legs poking straight out (a tadpole person)", typicalMonths: 36, sources: ["lowenfeld"] },
      { id: "art.names-colors", statement: "Names the main colors while drawing or painting", typicalMonths: 42, sources: ["cdc", "elof"] },
      { id: "art.names-picture", statement: "Tells you what their picture is ('that's our house')", typicalMonths: 52, sources: ["elof", "nca"] },
      { id: "art.recognizable", statement: "Draws recognizable things on purpose: people, houses, suns", typicalMonths: 60, sources: ["cdc", "nca"] },
      { id: "art.story-details", statement: "Adds details that tell a story: a sad face, a rainbow over the house", typicalMonths: 72, sources: ["nca"] },
      { id: "art.plans-artwork", statement: "Plans what to make before starting, and sticks with it to done", typicalMonths: 84, sources: ["nca"] },
      { id: "art.ground-sky", statement: "Draws scenes standing on a ground line, with sky up top", typicalMonths: 90, sources: ["lowenfeld"] },
      { id: "art.talks-choices", statement: "Talks about art choices ('I used blue because...') and notices other people's art", typicalMonths: 96, sources: ["nca"] },
      { id: "art.realism-detail", statement: "Works at making things look real: proportion, overlapping, backgrounds", typicalMonths: 120, sources: ["nca"] },
      { id: "art.technique", statement: "Uses techniques on purpose: shading, perspective, color schemes for a mood", typicalMonths: 148, sources: ["nca"] },
      { id: "art.observation", statement: "Draws or paints from observation (a real object, a photo, a scene) with care", typicalMonths: 166, sources: ["nca"] },
      { id: "art.personal-style", statement: "Has a direction of their own: a style, a medium, a series they keep developing", typicalMonths: 192, sources: ["nca"] },
    ],
  },
  {
    id: "music",
    displayName: "Music",
    intro: "Music: rhythm, songs, listening.",
    whatItIs:
      "Music is rhythm, singing, and listening closely. Feeling a steady beat and playing with sounds runs right alongside early reading skills like hearing the parts of words.",
    exposureBased: false,
    growingActivity: {
      title: "Copy my clap",
      description:
        "Clap a short pattern, they echo it, then swap leaders. Wooden spoons and pot lids welcome.",
    },
    growingActivityOlder: {
      title: "Find it by ear",
      description:
        "Pick a melody they love and find it by ear on any instrument or piano app. Ears first, notation later.",
    },
    items: [
      { id: "music.moves-to-music", statement: "Bounces, sways, or dances when music plays", typicalMonths: 30, sources: ["cdc", "nca"] },
      { id: "music.sings-along", statement: "Sings along with parts of favorite songs", typicalMonths: 40, sources: ["cdc", "nca"] },
      { id: "music.steady-beat", statement: "Claps or taps along to a steady beat", typicalMonths: 50, sources: ["nca", "elof"] },
      { id: "music.whole-song", statement: "Sings a whole song from memory", typicalMonths: 60, sources: ["cdc", "nca"] },
      { id: "music.echoes-rhythm", statement: "Copies a simple rhythm pattern you clap (clap-clap-pause-clap)", typicalMonths: 72, sources: ["nca"] },
      { id: "music.hears-dynamics", statement: "Notices loud and soft, fast and slow in music, and talks about it", typicalMonths: 84, sources: ["nca"] },
      { id: "music.rhythm-notation", statement: "Follows simple rhythm or picture notation while singing or playing", typicalMonths: 88, sources: ["nca"], standards: ["NCAS MU:Pr4.2.1b"] },
      { id: "music.holds-part", statement: "Keeps their own part going in a group song or a round", typicalMonths: 96, sources: ["nca"] },
      { id: "music.reads-notation", statement: "Reads simple music notation or plays short pieces on an instrument", typicalMonths: 122, sources: ["nca"], standards: ["NCAS MU:Pr4.2.5b"] },
      { id: "music.practices-instrument", statement: "Practices an instrument or voice regularly and hears their own mistakes", typicalMonths: 148, sources: ["nca"] },
      { id: "music.plays-with-others", statement: "Plays or sings with others, staying in time and in balance with the group", typicalMonths: 168, sources: ["nca"] },
      { id: "music.interprets", statement: "Shapes how a piece sounds on purpose: phrasing, dynamics, style, or writes their own", typicalMonths: 192, sources: ["nca"] },
    ],
  },
  {
    id: "gross_motor",
    displayName: "Gross motor",
    intro: "Big movement: running, jumping, balance.",
    whatItIs:
      "Gross motor is big-body movement: running, jumping, balancing, throwing. It is how kids build the strength and coordination the rest of their day leans on.",
    exposureBased: false,
    growingActivity: {
      title: "Animal races",
      description:
        "Race down the hallway as animals: bear crawl, crab walk, frog jump. New animal each round.",
    },
    growingActivityOlder: {
      title: "Pick your sweat",
      description:
        "They pick 20 minutes of movement a day this week, any kind, and keep their own tally. Owning it builds the habit.",
    },
    items: [
      { id: "gross_motor.runs-climbs", statement: "Runs without falling and climbs onto furniture by themselves", typicalMonths: 28, sources: ["cdc"] },
      { id: "gross_motor.jumps-two-feet", statement: "Jumps with both feet off the ground", typicalMonths: 38, sources: ["cdc", "shape"] },
      { id: "gross_motor.pedals", statement: "Pedals a tricycle (or a bike with training wheels)", typicalMonths: 44, sources: ["cdc"] },
      { id: "gross_motor.gallops", statement: "Gallops, one foot leading the other", typicalMonths: 48, sources: ["shape"] },
      { id: "gross_motor.one-foot-hop", statement: "Stands on one foot for a few seconds and hops", typicalMonths: 52, sources: ["cdc", "shape"] },
      { id: "gross_motor.catches-ball", statement: "Catches a big ball most of the time", typicalMonths: 58, sources: ["cdc", "shape"] },
      { id: "gross_motor.skips", statement: "Skips with alternating feet", typicalMonths: 68, sources: ["shape"] },
      { id: "gross_motor.dodges", statement: "Runs, stops, and changes direction with control in chase games", typicalMonths: 80, sources: ["shape"] },
      // Range: the AAP's 4-to-7 readiness window (00-synthesis, porting
      // status: "evidence-based anchor move... AAP 4-to-7 window").
      { id: "gross_motor.rides-bike", statement: "Rides a two-wheeler confidently, starting and stopping on their own", typicalMonths: 84, typicalRangeMonths: [48, 84], sources: ["aap-lifeskills", "shape"] },
      { id: "gross_motor.swims-basic", statement: "Swims a short stretch and climbs out of the pool on their own", typicalMonths: 88, sources: ["aap-lifeskills"] },
      { id: "gross_motor.jumps-rope", statement: "Jumps rope a few times in a row", typicalMonths: 94, sources: ["shape"], standards: ["SHAPE 1.2.16"] },
      { id: "gross_motor.game-skills", statement: "Throws, catches, and kicks well enough to really play a game (soccer, catch, basketball)", typicalMonths: 126, sources: ["shape"] },
      { id: "gross_motor.strategy", statement: "Plays team games with strategy: getting open, defending, reading the play", typicalMonths: 152, sources: ["shape"] },
      { id: "gross_motor.trains", statement: "Sticks with a physical activity they chose: a sport, dance, hiking, lifting", typicalMonths: 176, sources: ["shape"] },
      { id: "gross_motor.own-fitness", statement: "Manages their own fitness: warms up, paces effort, works toward a goal", typicalMonths: 198, sources: ["shape"] },
    ],
  },
  {
    id: "fine_motor",
    displayName: "Fine motor",
    intro: "Small-hand skills.",
    whatItIs:
      "Fine motor is small-hand control: grip, drawing, scissors, buttons. It is the muscle work underneath handwriting, dressing, and making things.",
    exposureBased: false,
    growingActivity: {
      title: "Snipping strips",
      description:
        "Cut paper into strips and let them snip confetti into a jar, then along a drawn line. Child-safe scissors, five minutes.",
    },
    growingActivityOlder: {
      title: "Fix-it project",
      description:
        "One small repair or build together: a loose screw, a model kit, a hem. Real tools, real result.",
    },
    items: [
      { id: "fine_motor.tower-4", statement: "Stacks a tower of 4 or more blocks", typicalMonths: 28, sources: ["cdc"] },
      { id: "fine_motor.lids-pages", statement: "Opens twist lids and turns book pages one at a time", typicalMonths: 38, sources: ["cdc"] },
      { id: "fine_motor.pours", statement: "Pours water between cups without much spilling", typicalMonths: 44, sources: ["elof"] },
      { id: "fine_motor.beads", statement: "Strings large beads or threads laces", typicalMonths: 50, sources: ["elof", "cdc"] },
      { id: "fine_motor.cuts-line", statement: "Cuts along a straight line with child scissors", typicalMonths: 58, sources: ["elof", "cdc"] },
      { id: "fine_motor.puzzle-20", statement: "Puts together a 20-plus piece jigsaw puzzle on their own", typicalMonths: 70, sources: ["elof"] },
      { id: "fine_motor.cuts-curves", statement: "Cuts out a circle or curved shape fairly neatly", typicalMonths: 80, sources: ["elof", "hwt"] },
      { id: "fine_motor.fiddly-builds", statement: "Builds fiddly things: small brick sets from the booklet, braids, simple knots", typicalMonths: 92, sources: ["shape", "hwt"] },
      { id: "fine_motor.cursive", statement: "Writes in cursive, joining letters smoothly", typicalMonths: 108, sources: ["hwt"] },
      { id: "fine_motor.kitchen-tools", statement: "Uses kitchen tools with control: measures accurately, chops with supervision", typicalMonths: 118, sources: ["aap-lifeskills"] },
      { id: "fine_motor.crafts", statement: "Does precise handwork: sewing a seam, detailed models, jewelry, whittling", typicalMonths: 140, sources: ["hwt", "nca"] },
      { id: "fine_motor.builds-technical", statement: "Builds technical things: robotics, circuits, repairs with screwdriver and pliers", typicalMonths: 160, sources: ["ngss"] },
      { id: "fine_motor.precision-work", statement: "Works at precision: lab tools, soldering, tailoring, detailed fabrication", typicalMonths: 190, sources: ["ngss", "hwt"] },
    ],
  },
  {
    id: "social_emotional",
    displayName: "Social-emotional",
    intro: "Feelings and friends.",
    whatItIs:
      "Social-emotional is feelings and friendships: naming emotions, taking turns, playing with others, and settling after upsets. Learning of every kind sits on top of it.",
    exposureBased: false,
    growingActivity: {
      title: "Name it to tame it",
      description:
        "When big feelings hit, name the feeling first, then offer two choices for what to do next. Naming is half the calming.",
    },
    growingActivityOlder: {
      title: "Rose, thorn, bud",
      description:
        "At dinner: one good thing, one hard thing, one thing they're looking forward to. Naming feelings is the skill at every age.",
    },
    items: [
      { id: "social_emotional.notices-upset", statement: "Notices when someone is upset and reacts (a pat, bringing a toy)", typicalMonths: 30, sources: ["cdc", "casel"] },
      { id: "social_emotional.names-feelings", statement: "Names simple feelings: happy, sad, mad", typicalMonths: 40, sources: ["cdc", "casel"] },
      { id: "social_emotional.plays-with", statement: "Plays WITH other kids: takes turns and shares, with reminders", typicalMonths: 50, sources: ["cdc", "casel"] },
      { id: "social_emotional.false-belief", statement: "Gets that someone else can believe something that isn't true: the heart of hiding games and surprises", typicalMonths: 56, sources: ["wellman"] },
      { id: "social_emotional.feeling-because", statement: "Says why they feel a way ('I'm mad because...')", typicalMonths: 58, sources: ["cdc", "casel"] },
      { id: "social_emotional.calming-strategy", statement: "Calms down with a strategy when you prompt one: breaths, a break, asking for help", typicalMonths: 66, sources: ["casel", "cdc"] },
      { id: "social_emotional.handles-losing", statement: "Follows game rules and handles losing without a meltdown, most of the time", typicalMonths: 78, sources: ["casel"] },
      { id: "social_emotional.resolves-conflict", statement: "Works out small conflicts with words on their own", typicalMonths: 90, sources: ["casel"] },
      { id: "social_emotional.reads-others", statement: "Notices how others feel and adjusts ('she's shy, let's ask her to play')", typicalMonths: 100, sources: ["casel"] },
      { id: "social_emotional.confide-friend", statement: "Keeps a close friend they confide in, working through the bumps", typicalMonths: 112, sources: ["casel"] },
      { id: "social_emotional.names-triggers", statement: "Knows their own triggers ('I get frustrated when...') and uses a calming strategy without being told", typicalMonths: 122, sources: ["casel"] },
      { id: "social_emotional.keeps-friends", statement: "Keeps a few steady friendships through ordinary ups and downs", typicalMonths: 138, sources: ["casel"] },
      { id: "social_emotional.perspective", statement: "Sees a conflict from the other person's side, even mid-disagreement", typicalMonths: 158, sources: ["casel"] },
      { id: "social_emotional.handles-pressure", statement: "Handles peer pressure with their own judgment, and talks about it", typicalMonths: 176, sources: ["casel"] },
      { id: "social_emotional.regulates-stakes", statement: "Manages nerves in high-stakes moments (performance, tryout, hard conversation) and recovers from setbacks", typicalMonths: 196, sources: ["casel"] },
    ],
  },
  {
    id: "self_care",
    displayName: "Self-care",
    intro: "Everyday independence.",
    whatItIs:
      "Self-care is everyday independence: dressing, eating, washing, and keeping track of their own things. Every skill here hands the child a little more of their own day.",
    exposureBased: false,
    growingActivity: {
      title: "The button board",
      description:
        "Button an old shirt around a cushion and buttons become a game instead of a morning fight. Race the timer, never each other.",
    },
    growingActivityOlder: {
      title: "Own one meal",
      description:
        "They own one family meal a week: plan it, shop the list, cook it, serve it.",
    },
    items: [
      { id: "self_care.spoon-cup", statement: "Feeds themselves with a spoon and drinks from an open cup", typicalMonths: 28, sources: ["cdc"] },
      { id: "self_care.easy-clothes", statement: "Pulls on easy clothes (elastic pants, a loose shirt) by themselves", typicalMonths: 40, sources: ["cdc"] },
      { id: "self_care.toilet-day", statement: "Uses the toilet during the day, with only the occasional miss", typicalMonths: 48, sources: ["cdc"] },
      { id: "self_care.washes-hands", statement: "Washes hands start to finish without help", typicalMonths: 56, sources: ["cdc", "elof"] },
      { id: "self_care.dresses-alone", statement: "Gets fully dressed alone, except tricky buttons or laces", typicalMonths: 62, sources: ["cdc", "elof"] },
      { id: "self_care.brushes-teeth", statement: "Brushes their own teeth well (you just spot-check)", typicalMonths: 66, sources: ["aap-lifeskills"] },
      { id: "self_care.buttons-zips", statement: "Manages buttons, zippers, coat, and shoes on their own", typicalMonths: 72, sources: ["cdc", "elof"] },
      { id: "self_care.ties-laces", statement: "Ties shoelaces", typicalMonths: 84, sources: ["cdc"] },
      { id: "self_care.morning-routine", statement: "Runs a morning routine from a list (dress, teeth, bed) without step-by-step help", typicalMonths: 96, sources: ["casel", "harvard-ef"] },
      { id: "self_care.simple-food", statement: "Makes their own simple food: lunch, snacks, the microwave and toaster", typicalMonths: 116, sources: ["aap-lifeskills"] },
      { id: "self_care.stove-supervised", statement: "Uses the stove to cook something, with you nearby", typicalMonths: 126, sources: ["aap-lifeskills"] },
      { id: "self_care.own-hygiene", statement: "Owns their hygiene completely: showers, hair, deodorant, no reminders needed", typicalMonths: 138, sources: ["aap-lifeskills"] },
      { id: "self_care.cooks-laundry", statement: "Cooks a simple meal on the stove and does their own laundry start to finish", typicalMonths: 158, sources: ["aap-lifeskills"] },
      { id: "self_care.manages-money", statement: "Manages some money of their own: earning, saving toward something, spending choices", typicalMonths: 176, sources: ["aap-lifeskills", "c3"] },
      { id: "self_care.adult-errands", statement: "Handles real-world errands alone: a store run, an appointment, a bus or a drive", typicalMonths: 198, sources: ["aap-lifeskills"] },
    ],
  },
  {
    id: "executive_function",
    displayName: "Executive function",
    intro: "Focus, memory, follow-through.",
    whatItIs:
      "Executive function is focus, memory, and follow-through: holding a plan in mind, waiting a turn, switching gears, finishing. It is what turns knowing into doing, and it keeps growing all the way through the teen years.",
    exposureBased: false,
    growingActivity: {
      title: "Freeze dance",
      description:
        "Music on, dance big. Music off, freeze. Impulse control, dressed up as a dance party.",
    },
    growingActivityOlder: {
      title: "The backwards plan",
      description:
        "Take one due date and plan backwards on paper: what has to happen the day before, the week before. Do it together once, then hand it over.",
    },
    items: [
      { id: "executive_function.focus-5", statement: "Settles into an activity they chose and stays with it a while", typicalMonths: 30, sources: ["harvard-ef", "elof"] },
      { id: "executive_function.two-steps", statement: "Follows a 2-step direction: 'get your shoes and your jacket'", typicalMonths: 40, sources: ["cdc", "harvard-ef"] },
      { id: "executive_function.waits-turn", statement: "Waits a short turn without falling apart (with support)", typicalMonths: 50, sources: ["cdc", "casel"] },
      { id: "executive_function.stop-go", statement: "Plays a stop-and-go game (freeze dance, Red Light Green Light) and holds the rule", typicalMonths: 54, sources: ["harvard-ef"] },
      { id: "executive_function.plan-changes", statement: "Handles small changes of plan without a meltdown, most days", typicalMonths: 58, sources: ["cdc", "harvard-ef"] },
      { id: "executive_function.focus-15", statement: "Sees a sit-down activity through to the end: a puzzle, a craft, a book", typicalMonths: 66, sources: ["harvard-ef", "elof"] },
      { id: "executive_function.three-steps", statement: "Follows a 3-step direction given just once", typicalMonths: 78, sources: ["harvard-ef"] },
      { id: "executive_function.starts-tasks", statement: "Starts a known job without being reminded (feed the cat, pack the bag)", typicalMonths: 90, sources: ["harvard-ef", "casel"] },
      { id: "executive_function.little-project", statement: "Plans a little project (a fort, a lemonade stand) and follows it through", typicalMonths: 100, sources: ["harvard-ef", "casel"] },
      { id: "executive_function.multi-day", statement: "Keeps track of a multi-day assignment and finishes without last-minute panic", typicalMonths: 126, sources: ["dawson-guare"] },
      { id: "executive_function.own-schedule", statement: "Keeps their own schedule: practices, assignments, chores, mostly without prompts", typicalMonths: 148, sources: ["dawson-guare"] },
      { id: "executive_function.estimates-time", statement: "Estimates how long something will take and plans around it", typicalMonths: 156, sources: ["dawson-guare"] },
      { id: "executive_function.breaks-down-projects", statement: "Breaks a big project into steps and paces the work across weeks", typicalMonths: 168, sources: ["dawson-guare"] },
      { id: "executive_function.study-skills", statement: "Studies effectively on their own: notes, review plan, knows what they don't know yet", typicalMonths: 186, sources: ["dawson-guare"] },
      { id: "executive_function.long-goals", statement: "Works toward a months-long goal (a job, a team, a portfolio) with minimal outside structure", typicalMonths: 202, sources: ["dawson-guare", "casel"] },
    ],
  },
  {
    id: "computer_science",
    displayName: "Coding & computers",
    intro:
      "Almost done: computers and code. If that's not part of your world yet, one tap on skip is fine.",
    whatItIs:
      "Coding and computers follows what your family actually does with technology: giving step-by-step instructions, building small projects, fixing what misbehaves. No ages attached here; it simply follows what is part of your home.",
    exposureBased: true,
    growingActivity: {
      title: "Robot parent",
      description:
        "They program you across the room with exact steps, and you do exactly what was said, wrong steps included. Debugging starts as giggles.",
    },
    growingActivityOlder: {
      title: "Automate one thing",
      description:
        "Pick one small real job (a timer, a chore chart, a spreadsheet formula) and build the thing that does it. Real problem, real program.",
    },
    items: [
      // Founder wording call 2026-07-08: no game name in the question.
      // Naming "robot" narrowed it (kids who never played a game by that
      // name still give exact instructions in play, which is the skill).
      // The id keeps the old slug: stored answers key off it.
      { id: "computer_science.robot-game", statement: "Gives exact step-by-step instructions during play and follows yours", typicalMonths: 66, sources: ["csta"], standards: ["CSTA 1A-AP-08"] },
      { id: "computer_science.block-sequence", statement: "Builds a little program in a block-coding app (ScratchJr, Scratch): steps that run in order", typicalMonths: 84, sources: ["csta"], standards: ["CSTA 1A-AP-10"] },
      { id: "computer_science.finds-bug", statement: "Hunts down which step is wrong when their program misbehaves, and fixes it", typicalMonths: 96, sources: ["csta"], standards: ["CSTA 1A-AP-14"] },
      { id: "computer_science.loops-events", statement: "Uses loops and events on purpose ('when clicked, repeat 10 times')", typicalMonths: 112, sources: ["csta"], standards: ["CSTA 1B-AP-10"] },
      { id: "computer_science.variables", statement: "Uses variables in a project: a score counter, a saved answer", typicalMonths: 126, sources: ["csta"], standards: ["CSTA 1B-AP-09"] },
      { id: "computer_science.plans-decomposes", statement: "Breaks a program idea into parts and sketches the plan before building", typicalMonths: 156, sources: ["csta"], standards: ["CSTA 2-AP-10", "CSTA 2-AP-13"] },
      { id: "computer_science.text-language", statement: "Writes and runs code in a text language like Python or JavaScript", typicalMonths: 174, sources: ["csta"] },
      { id: "computer_science.ships-something", statement: "Builds something real with code that someone else actually uses, and explains how it works", typicalMonths: 192, sources: ["csta"] },
    ],
  },
  {
    id: "spanish",
    displayName: "Second language",
    intro: "Last one: is a second language (Spanish, French, sign, anything) part of your home? If not, one tap on skip and we're done.",
    whatItIs:
      "A second language follows what your home does, not milestones: hearing it, playing with it, using words from it. No ages attached here; any amount counts.",
    exposureBased: true,
    growingActivity: {
      title: "One phrase week",
      description:
        "Pick one useful phrase and use it all week at natural moments. One phrase that sticks beats ten that don't.",
    },
    growingActivityOlder: {
      title: "Subtitles flip",
      description:
        "Watch a favorite show in the language with subtitles on, ten minutes at a time. Learning that feels like screen time.",
    },
    items: [
      { id: "spanish.understands-words", statement: "Understands common everyday words in that language (water, milk, more)", typicalMonths: 36, sources: ["actfl", "hoff-core"] },
      { id: "spanish.says-words", statement: "Says single words or greetings in that language on their own", typicalMonths: 54, sources: ["actfl", "hoff-core"], standards: ["ACTFL Novice Low"] },
      { id: "spanish.counts-sings", statement: "Counts to 10 in that language from memory (or sings a whole song in it)", typicalMonths: 60, sources: ["hoff-core", "actfl"], standards: ["ACTFL Novice Low"] },
      { id: "spanish.follows-phrases", statement: "Follows simple spoken phrases in that language ('come here', 'give me your hand')", typicalMonths: 72, sources: ["actfl"] },
      { id: "spanish.answers-simple", statement: "Answers a simple familiar question in that language with a word or phrase", typicalMonths: 84, sources: ["actfl"], standards: ["ACTFL Novice Mid"] },
      { id: "spanish.code-switches", statement: "Switches languages to match the listener, without losing the thread", typicalMonths: 96, sources: ["hoff-core"] },
      { id: "spanish.simple-exchanges", statement: "Handles short practiced exchanges in that language: greetings, likes and dislikes, simple questions", typicalMonths: 120, sources: ["actfl"], standards: ["ACTFL Novice High"] },
      { id: "spanish.creates-sentences", statement: "Makes their own sentences in that language instead of only reciting learned phrases", typicalMonths: 156, sources: ["actfl"], standards: ["ACTFL Intermediate Low"] },
      { id: "spanish.conversation", statement: "Holds a simple conversation in that language, recovering when they get stuck", typicalMonths: 192, sources: ["actfl"], standards: ["ACTFL Intermediate Mid"] },
    ],
  },
];
