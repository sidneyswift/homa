/**
 * The map content bank, v2026.07.1: ages 2 to 16 (scored), 15 domains.
 *
 * Provenance: ported and extended from homa-template's questionnaire bank
 * (workspace/questionnaire/domains.json) and its citation-backed benchmark
 * library (workspace/benchmarks/*.md, PreK through grade 12). Every item's
 * typicalMonths is the age in months by which the behavior is typical per
 * the cited frameworks; the scorer reads months-ahead off these anchors.
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
}

export interface MapDomainContent {
  id: string;
  displayName: string;
  intro: string;
  exposureBased: boolean;
  growingActivity: { title: string; description: string };
  /** Age-appropriate swap for kids ~8 and up (the report picks by age). */
  growingActivityOlder?: { title: string; description: string };
  items: readonly MapItemContent[];
}

/** Citation registry: every item's `sources` keys resolve here. */
export const MAP_SOURCES: Record<string, { label: string; url: string }> = {
  cdc: {
    label: "CDC, Learn the Signs. Act Early. milestone checklists (2022 revision)",
    url: "https://www.cdc.gov/ncbddd/actearly/milestones/index.html",
  },
  elof: {
    label: "Head Start Early Learning Outcomes Framework (ELOF), ages 3 to 5",
    url: "https://eclkc.ohs.acf.hhs.gov/school-readiness/article/interactive-head-start-early-learning-outcomes-framework",
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
    url: "https://www.healthychildren.org/",
  },
  asha: {
    label: "ASHA school-age speech and language milestones",
    url: "https://www.asha.org/public/speech/development/",
  },
};

export const MAP_DOMAINS: readonly MapDomainContent[] = [
  {
    id: "math",
    displayName: "Math",
    intro: "First up: numbers.",
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
      { id: "math.counts-to-5", statement: "Counts out loud from 1 to 5, mostly in order", typicalMonths: 30, sources: ["elof", "clements-sarama"] },
      { id: "math.counts-to-10", statement: "Counts out loud to 10 without skipping numbers", typicalMonths: 42, sources: ["elof", "clements-sarama"] },
      { id: "math.how-many-5", statement: "Counts 5 objects one at a time and tells you how many there are", typicalMonths: 48, sources: ["elof", "cdc"] },
      { id: "math.counts-past-20", statement: "Counts past 20 without getting stuck", typicalMonths: 54, sources: ["elof", "ccss-math"] },
      { id: "math.adds-with-objects", statement: "Figures out 2 cookies plus 1 more, using objects or fingers", typicalMonths: 60, sources: ["elof", "clements-sarama"] },
      { id: "math.counts-to-100", statement: "Counts to 100, by ones or by tens", typicalMonths: 72, sources: ["ccss-math"] },
      { id: "math.mental-add-10", statement: "Adds and subtracts small numbers in their head, like 7 plus 2", typicalMonths: 84, sources: ["ccss-math"] },
      { id: "math.skip-counting", statement: "Skip-counts by 5s, 10s, and 100s, and reads 3-digit numbers", typicalMonths: 96, sources: ["ccss-math"] },
      { id: "math.times-tables", statement: "Knows multiplication facts through 10 from memory", typicalMonths: 110, sources: ["ccss-math"] },
      { id: "math.long-multiply", statement: "Multiplies multi-digit numbers and divides with remainders on paper", typicalMonths: 126, sources: ["ccss-math"] },
      { id: "math.fractions-decimals", statement: "Adds, subtracts, and compares fractions and decimals comfortably", typicalMonths: 140, sources: ["ccss-math"] },
      { id: "math.ratios-percents", statement: "Works with ratios, percents, and negative numbers", typicalMonths: 152, sources: ["ccss-math"] },
      { id: "math.solves-equations", statement: "Solves multi-step equations with a variable, like 3x + 4 = 19", typicalMonths: 170, sources: ["ccss-math"] },
      { id: "math.algebra-functions", statement: "Handles algebra comfortably: graphs a line, works with functions", typicalMonths: 190, sources: ["ccss-math"] },
      { id: "math.advanced-tools", statement: "Uses quadratics or right-triangle trig to solve real problems", typicalMonths: 204, sources: ["ccss-math"] },
    ],
  },
  {
    id: "literacy",
    displayName: "Literacy",
    intro: "Next: books and reading.",
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
      { id: "literacy.own-name-letters", statement: "Recognizes the letters in their own name", typicalMonths: 42, sources: ["elof"] },
      { id: "literacy.uppercase-half", statement: "Names more than half of the uppercase letters", typicalMonths: 52, sources: ["elof"] },
      { id: "literacy.retells-story", statement: "Retells a story you just read: what happened first, and how it ended", typicalMonths: 60, sources: ["cdc", "elof"] },
      { id: "literacy.sight-words", statement: "Reads their own name and a few familiar words on sight (like STOP)", typicalMonths: 64, sources: ["elof", "ccss-ela"] },
      { id: "literacy.emergent-reader", statement: "Reads a very simple book (a line or two per page) mostly on their own", typicalMonths: 72, sources: ["ccss-ela"] },
      { id: "literacy.reads-short-book", statement: "Reads a short book out loud and tells you about it after", typicalMonths: 84, sources: ["ccss-ela"] },
      { id: "literacy.chapter-books", statement: "Reads early chapter books and retells the plot", typicalMonths: 96, sources: ["ccss-ela"] },
      { id: "literacy.novels", statement: "Reads a novel on their own and follows the plot across chapters", typicalMonths: 110, sources: ["ccss-ela"] },
      { id: "literacy.main-idea-evidence", statement: "Explains the main idea of an article and backs it up with details from the text", typicalMonths: 128, sources: ["ccss-ela"] },
      { id: "literacy.theme-evidence", statement: "Talks about a book's theme and points to evidence for it", typicalMonths: 146, sources: ["ccss-ela"] },
      { id: "literacy.judges-arguments", statement: "Reads an argument and judges whether the evidence really supports it", typicalMonths: 164, sources: ["ccss-ela"] },
      { id: "literacy.dense-texts", statement: "Reads dense material (history, science, literature) and discusses it critically", typicalMonths: 184, sources: ["ccss-ela"] },
      { id: "literacy.interpretations", statement: "Compares different interpretations of a text and defends their own reading", typicalMonths: 202, sources: ["ccss-ela"] },
    ],
  },
  {
    id: "phonics",
    displayName: "Phonics",
    intro: "Sounds, rhymes, and sounding out words.",
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
      { id: "phonics.joins-rhymes", statement: "Joins in on rhymes and rhyming songs they know", typicalMonths: 36, sources: ["elof"] },
      { id: "phonics.claps-syllables", statement: "Claps the beats in a word, like ba-na-na", typicalMonths: 48, sources: ["elof", "ccss-ela"] },
      { id: "phonics.judges-rhyme", statement: "Tells you whether two words rhyme (cat, hat)", typicalMonths: 54, sources: ["elof", "ccss-ela"] },
      { id: "phonics.letter-sounds-10", statement: "Knows the sounds for 10 or more letters (the sound, not the name)", typicalMonths: 60, sources: ["elof", "ccss-ela"] },
      { id: "phonics.blends-cvc", statement: "Blends sounds you stretch out into a word: c-a-t makes cat", typicalMonths: 64, sources: ["ccss-ela"] },
      { id: "phonics.decodes-cvc", statement: "Sounds out simple 3-letter words from print on their own", typicalMonths: 72, sources: ["ccss-ela"] },
      { id: "phonics.digraphs-cvce", statement: "Reads words with sh, ch, th, and silent-e words like cake", typicalMonths: 84, sources: ["ccss-ela"] },
      { id: "phonics.two-syllable", statement: "Reads two-syllable words by chunking them (rab-bit)", typicalMonths: 96, sources: ["ccss-ela"] },
      { id: "phonics.multisyllable", statement: "Sounds out long unfamiliar words by chunking syllables (fantastic, remembering)", typicalMonths: 112, sources: ["ccss-ela"] },
      { id: "phonics.roots-prefixes", statement: "Uses roots and prefixes to figure out new words (bi-cycle, pre-view)", typicalMonths: 130, sources: ["ccss-ela"] },
      { id: "phonics.fluent-expression", statement: "Reads aloud smoothly with expression, self-correcting when something sounds off", typicalMonths: 150, sources: ["ccss-ela"] },
      { id: "phonics.technical-words", statement: "Reads technical words in science or history without stumbling (photosynthesis, constitution)", typicalMonths: 172, sources: ["ccss-ela"] },
    ],
  },
  {
    id: "writing",
    displayName: "Writing",
    intro: "Writing, from scribbles to sentences.",
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
      { id: "writing.writes-name", statement: "Writes their own first name so you can read it", typicalMonths: 62, sources: ["elof", "hwt"] },
      { id: "writing.most-letters", statement: "Writes most letters of the alphabet from memory", typicalMonths: 72, sources: ["hwt", "ccss-ela"] },
      { id: "writing.readable-sentence", statement: "Writes a readable sentence with spaces between the words", typicalMonths: 84, sources: ["ccss-ela", "hwt"] },
      { id: "writing.several-sentences", statement: "Writes a few sentences in a row, neat enough for anyone to read", typicalMonths: 96, sources: ["ccss-ela", "hwt"] },
      { id: "writing.paragraph", statement: "Writes a paragraph with a beginning, middle, and end, mostly punctuated right", typicalMonths: 112, sources: ["ccss-ela"] },
      { id: "writing.multi-paragraph", statement: "Writes a page or more that stays organized: a story, a report, a letter", typicalMonths: 130, sources: ["ccss-ela", "hwt"] },
      { id: "writing.typing", statement: "Types comfortably, a full page in one sitting", typicalMonths: 144, sources: ["ccss-ela", "hwt"] },
      { id: "writing.essay-evidence", statement: "Writes an essay that makes a claim and supports it with evidence", typicalMonths: 162, sources: ["ccss-ela"] },
      { id: "writing.revises-drafts", statement: "Drafts, revises, and polishes longer pieces without being walked through it", typicalMonths: 182, sources: ["ccss-ela"] },
      { id: "writing.research-paper", statement: "Writes a research paper drawing on several sources, cited", typicalMonths: 200, sources: ["ccss-ela"] },
    ],
  },
  {
    id: "language",
    displayName: "Language",
    intro: "Talking and telling stories.",
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
      { id: "language.short-sentences", statement: "Speaks in short sentences that strangers mostly understand", typicalMonths: 38, sources: ["cdc", "elof"] },
      { id: "language.tells-about-day", statement: "Tells you about something that happened earlier today", typicalMonths: 48, sources: ["cdc", "elof"] },
      { id: "language.why-how", statement: "Asks why and how questions, and stays on topic when you answer", typicalMonths: 54, sources: ["cdc", "elof"] },
      { id: "language.whole-story", statement: "Tells a whole little story with a beginning and an end", typicalMonths: 60, sources: ["cdc"] },
      { id: "language.tenses", statement: "Uses past and future naturally ('we went', 'we're going to')", typicalMonths: 68, sources: ["cdc", "elof"] },
      { id: "language.explains-steps", statement: "Explains how to do something step by step, like the rules of a game", typicalMonths: 84, sources: ["ccss-ela"] },
      { id: "language.real-conversation", statement: "Holds a real back-and-forth conversation with an adult, adding their own ideas", typicalMonths: 96, sources: ["ccss-ela"] },
      { id: "language.retells-organized", statement: "Recounts something they learned in an organized way, with the details that matter", typicalMonths: 112, sources: ["asha", "ccss-ela"] },
      { id: "language.figurative", statement: "Gets and uses figurative language ('this room is a zoo')", typicalMonths: 126, sources: ["asha", "ccss-ela"] },
      { id: "language.debates-fairly", statement: "Discusses a disagreement with reasons, and actually responds to the other side's point", typicalMonths: 148, sources: ["ccss-ela"] },
      { id: "language.adapts-audience", statement: "Shifts how they speak for the audience: grandma, a coach, a little cousin", typicalMonths: 164, sources: ["ccss-ela", "asha"] },
      { id: "language.presents", statement: "Presents to a group with a clear point and holds the room", typicalMonths: 186, sources: ["ccss-ela"] },
      { id: "language.persuades", statement: "Makes a persuasive case out loud, anticipating what the other side will say", typicalMonths: 202, sources: ["ccss-ela"] },
    ],
  },
  {
    id: "science",
    displayName: "Science",
    intro: "Science: noticing and finding out.",
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
      { id: "science.notices-nature", statement: "Notices bugs, weather, and animals and points them out to you", typicalMonths: 30, sources: ["elof"] },
      { id: "science.sorts-groups", statement: "Sorts things into groups: big vs small, animals vs plants", typicalMonths: 44, sources: ["elof", "ngss"] },
      { id: "science.predicts", statement: "Makes little predictions, like 'I think it will sink!'", typicalMonths: 52, sources: ["elof", "ngss"] },
      { id: "science.grow-change", statement: "Knows living things grow and change: seed to plant, caterpillar to butterfly", typicalMonths: 58, sources: ["elof", "ngss"] },
      { id: "science.explains-because", statement: "Explains what happened in their own words after trying something ('it melted because...')", typicalMonths: 68, sources: ["elof", "ngss"] },
      { id: "science.survival-needs", statement: "Tells you what plants and animals need to survive", typicalMonths: 74, sources: ["ngss"] },
      { id: "science.fair-question", statement: "Comes up with a question you can actually try out, changing just one thing", typicalMonths: 88, sources: ["ngss"] },
      { id: "science.reversible", statement: "Explains which changes can be undone (ice melts and refreezes) and which cannot (cooking an egg)", typicalMonths: 98, sources: ["ngss"] },
      { id: "science.records-data", statement: "Runs a fair test and records results in a chart or graph", typicalMonths: 116, sources: ["ngss"] },
      { id: "science.food-webs", statement: "Explains how energy moves through a food web, and what happens when a link breaks", typicalMonths: 132, sources: ["ngss"] },
      { id: "science.cells-systems", statement: "Explains cells, body systems, or chemical reactions in their own words", typicalMonths: 156, sources: ["ngss"] },
      { id: "science.evaluates-claims", statement: "Questions a science claim they hear online: what's the evidence, what's the source", typicalMonths: 172, sources: ["ngss"] },
      { id: "science.quantitative", statement: "Works with science quantitatively: balancing equations, computing forces, reading data critically", typicalMonths: 196, sources: ["ngss"] },
    ],
  },
  {
    id: "social_studies",
    displayName: "Social studies",
    intro: "Their world: people, places, the past.",
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
      { id: "social_studies.maps-real", statement: "Finds land and water on a map or globe and knows maps show real places", typicalMonths: 78, sources: ["c3"] },
      { id: "social_studies.city-state", statement: "Names their city, state, and country", typicalMonths: 90, sources: ["c3"] },
      { id: "social_studies.money-basics", statement: "Explains what money does: earning, spending, and saving up", typicalMonths: 100, sources: ["c3"] },
      { id: "social_studies.timelines", statement: "Reads a timeline and explains what caused a historical event", typicalMonths: 118, sources: ["c3"] },
      { id: "social_studies.maps-scale", statement: "Uses real maps: finds states and countries, reads a map key and scale", typicalMonths: 130, sources: ["c3"] },
      { id: "social_studies.government-branches", statement: "Explains how laws get made and what the branches of government do", typicalMonths: 150, sources: ["c3"] },
      { id: "social_studies.sources-bias", statement: "Asks who wrote a source and why, and notices point of view or bias", typicalMonths: 168, sources: ["c3"] },
      { id: "social_studies.current-events", statement: "Follows a current event and can explain more than one side of it", typicalMonths: 186, sources: ["c3"] },
      { id: "social_studies.civic-argument", statement: "Builds an evidence-based argument about a historical or civic question", typicalMonths: 202, sources: ["c3"] },
    ],
  },
  {
    id: "art",
    displayName: "Art & creative",
    intro: "Art: making things their way.",
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
      { id: "art.names-colors", statement: "Names the main colors while drawing or painting", typicalMonths: 42, sources: ["cdc", "elof"] },
      { id: "art.names-picture", statement: "Tells you what their picture is ('that's our house')", typicalMonths: 52, sources: ["elof", "nca"] },
      { id: "art.recognizable", statement: "Draws recognizable things on purpose: people, houses, suns", typicalMonths: 60, sources: ["cdc", "nca"] },
      { id: "art.story-details", statement: "Adds details that tell a story: a sad face, a rainbow over the house", typicalMonths: 72, sources: ["nca"] },
      { id: "art.plans-artwork", statement: "Plans what to make before starting, and sticks with it to done", typicalMonths: 84, sources: ["nca"] },
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
      { id: "music.holds-part", statement: "Keeps their own part going in a group song or a round", typicalMonths: 96, sources: ["nca"] },
      { id: "music.reads-notation", statement: "Reads simple music notation or plays short pieces on an instrument", typicalMonths: 122, sources: ["nca"] },
      { id: "music.practices-instrument", statement: "Practices an instrument or voice regularly and hears their own mistakes", typicalMonths: 148, sources: ["nca"] },
      { id: "music.plays-with-others", statement: "Plays or sings with others, staying in time and in balance with the group", typicalMonths: 168, sources: ["nca"] },
      { id: "music.interprets", statement: "Shapes how a piece sounds on purpose: phrasing, dynamics, style, or writes their own", typicalMonths: 192, sources: ["nca"] },
    ],
  },
  {
    id: "gross_motor",
    displayName: "Gross motor",
    intro: "Big movement: running, jumping, balance.",
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
      { id: "gross_motor.one-foot-hop", statement: "Stands on one foot for a few seconds and hops", typicalMonths: 52, sources: ["cdc", "shape"] },
      { id: "gross_motor.catches-ball", statement: "Catches a big ball most of the time", typicalMonths: 58, sources: ["cdc", "shape"] },
      { id: "gross_motor.skips", statement: "Skips with alternating feet", typicalMonths: 68, sources: ["shape"] },
      { id: "gross_motor.dodges", statement: "Runs, stops, and changes direction with control in chase games", typicalMonths: 80, sources: ["shape"] },
      { id: "gross_motor.jumps-rope", statement: "Jumps rope a few times in a row", typicalMonths: 94, sources: ["shape"] },
      { id: "gross_motor.rides-bike", statement: "Rides a two-wheeler confidently, starting and stopping on their own", typicalMonths: 108, sources: ["shape", "cdc"] },
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
      { id: "social_emotional.feeling-because", statement: "Says why they feel a way ('I'm mad because...')", typicalMonths: 58, sources: ["cdc", "casel"] },
      { id: "social_emotional.calming-strategy", statement: "Calms down with a strategy when you prompt one: breaths, a break, asking for help", typicalMonths: 66, sources: ["casel", "cdc"] },
      { id: "social_emotional.handles-losing", statement: "Follows game rules and handles losing without a meltdown, most of the time", typicalMonths: 78, sources: ["casel"] },
      { id: "social_emotional.resolves-conflict", statement: "Works out small conflicts with words on their own", typicalMonths: 90, sources: ["casel"] },
      { id: "social_emotional.reads-others", statement: "Notices how others feel and adjusts ('she's shy, let's ask her to play')", typicalMonths: 100, sources: ["casel"] },
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
      { id: "self_care.buttons-zips", statement: "Manages buttons, zippers, coat, and shoes on their own", typicalMonths: 72, sources: ["cdc", "elof"] },
      { id: "self_care.ties-laces", statement: "Ties shoelaces", typicalMonths: 84, sources: ["cdc"] },
      { id: "self_care.morning-routine", statement: "Runs a morning routine from a list (dress, teeth, bed) without step-by-step help", typicalMonths: 96, sources: ["casel", "harvard-ef"] },
      { id: "self_care.simple-food", statement: "Makes their own simple food: lunch, snacks, the microwave and toaster", typicalMonths: 116, sources: ["aap-lifeskills"] },
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
      { id: "executive_function.focus-5", statement: "Sticks with one activity for 5-plus minutes when interested", typicalMonths: 30, sources: ["harvard-ef", "elof"] },
      { id: "executive_function.two-steps", statement: "Follows a 2-step direction: 'get your shoes and your jacket'", typicalMonths: 40, sources: ["cdc", "harvard-ef"] },
      { id: "executive_function.waits-turn", statement: "Waits a short turn without falling apart (with support)", typicalMonths: 50, sources: ["cdc", "casel"] },
      { id: "executive_function.plan-changes", statement: "Handles small changes of plan without a meltdown, most days", typicalMonths: 58, sources: ["cdc", "harvard-ef"] },
      { id: "executive_function.focus-15", statement: "Focuses 10 to 15 minutes on a sit-down activity: puzzle, craft, book", typicalMonths: 66, sources: ["harvard-ef", "elof"] },
      { id: "executive_function.three-steps", statement: "Follows a 3-step direction given just once", typicalMonths: 78, sources: ["harvard-ef"] },
      { id: "executive_function.starts-tasks", statement: "Starts a known job without being reminded (feed the cat, pack the bag)", typicalMonths: 90, sources: ["harvard-ef", "casel"] },
      { id: "executive_function.little-project", statement: "Plans a little project (a fort, a lemonade stand) and follows it through", typicalMonths: 100, sources: ["harvard-ef", "casel"] },
      { id: "executive_function.multi-day", statement: "Keeps track of a multi-day assignment and finishes without last-minute panic", typicalMonths: 126, sources: ["dawson-guare"] },
      { id: "executive_function.own-schedule", statement: "Keeps their own schedule: practices, assignments, chores, mostly without prompts", typicalMonths: 148, sources: ["dawson-guare"] },
      { id: "executive_function.breaks-down-projects", statement: "Breaks a big project into steps and paces the work across weeks", typicalMonths: 168, sources: ["dawson-guare"] },
      { id: "executive_function.study-skills", statement: "Studies effectively on their own: notes, review plan, knows what they don't know yet", typicalMonths: 186, sources: ["dawson-guare"] },
      { id: "executive_function.long-goals", statement: "Works toward a months-long goal (a job, a team, a portfolio) with minimal outside structure", typicalMonths: 202, sources: ["dawson-guare", "casel"] },
    ],
  },
  {
    id: "spanish",
    displayName: "Second language",
    intro: "Last one: is a second language (Spanish, French, sign, anything) part of your home? If not, one tap on skip and we're done.",
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
      { id: "spanish.understands-words", statement: "Understands common everyday words in that language (water, milk, more)", typicalMonths: 36, sources: ["actfl"] },
      { id: "spanish.says-words", statement: "Says single words or greetings in that language on their own", typicalMonths: 54, sources: ["actfl"] },
      { id: "spanish.follows-phrases", statement: "Follows simple spoken phrases in that language ('come here', 'give me your hand')", typicalMonths: 72, sources: ["actfl"] },
      { id: "spanish.simple-exchanges", statement: "Handles short practiced exchanges in that language: greetings, likes and dislikes, simple questions", typicalMonths: 120, sources: ["actfl"] },
      { id: "spanish.creates-sentences", statement: "Makes their own sentences in that language instead of only reciting learned phrases", typicalMonths: 156, sources: ["actfl"] },
      { id: "spanish.conversation", statement: "Holds a simple conversation in that language, recovering when they get stuck", typicalMonths: 192, sources: ["actfl"] },
    ],
  },
];
