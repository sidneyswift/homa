import { createHash } from "node:crypto";

import { ANCHOR_MANIFEST } from "./anchor-manifest.generated";
import { isFleetAnchorUrl } from "./artifact-store";
import { MAX_REFERENCE_BYTES } from "./reference-limits";

/**
 * Fleet material anchors: shared, read-only reference images that the
 * materials studio hands to the image model to set the visual bar for a
 * format ("this good or better"). They are product assets, not family
 * data, so the same anchor is safe for every family: no tenant boundary
 * is involved.
 *
 * The model may only choose an anchor by id from this fixed registry; it
 * can never pass a URL through this path. The tool resolves the id to
 * trusted bytes: the JPEGs live in Vercel Blob under
 * fleet/material-anchors/<id>-<sha12>.jpg (public, content-addressed),
 * and anchor-manifest.generated.ts records each anchor's URL and sha256.
 * scripts/build-material-anchors.mts uploads anchor-sources/*.jpg and
 * writes the manifest; loadStudioAnchorBytes fetches a manifest URL only
 * after isFleetAnchorUrl accepts it and verifies the sha256 before handing
 * bytes on. Family reference images keep going through isFamilyArtifactUrl
 * untouched.
 *
 * Isolated eval runs (lib/eval-isolation.ts) scrub write credentials but
 * do not block network egress, and the anchor store is public, so evals
 * read anchors from the same Blob URLs production does; no sandbox
 * seeding is needed.
 *
 * Register mirrors the style directive's age/seriousness dial: `playful`
 * anchors carry full handmade warmth; `restrained` anchors stay clean and
 * grown-up. See the materials-studio SKILL.md for how Homa picks one.
 */
export type MaterialAnchorRegister = "playful" | "restrained";

export interface MaterialAnchor {
  readonly id: string;
  readonly title: string;
  /** Routing instruction: the intent that should select this anchor. */
  readonly useWhen: string;
  readonly register: MaterialAnchorRegister;
  readonly mediaType: string;
}

const JPEG = "image/jpeg";

const REGISTRY: readonly MaterialAnchor[] = [
  {
    id: "order-of-operations-chart",
    title: "Order of operations (PEMDAS/GEMDAS) reference chart",
    useWhen:
      "building a math reference chart, poster, or foldable about the order of operations (PEMDAS or GEMDAS)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "five-paragraph-essay-outline",
    title: "Five-paragraph essay outline / writing scaffold",
    useWhen:
      "building an essay outline, a writing scaffold, or a structured planning sheet for older students",
    register: "restrained",
    mediaType: JPEG,
  },
  {
    id: "foldable",
    title: "Foldable / interactive notebook insert",
    useWhen: "building a foldable or interactive notebook insert",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "cut-and-paste-word-work",
    title: "Cut-and-paste CVC word work page",
    useWhen: "building a cut-and-paste word work page for early phonics or CVC words",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "number-practice-page",
    title: "Single-number practice page",
    useWhen:
      "building a single-number practice page (trace, ten-frame, count, color)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "math-practice",
    title: "General math practice page",
    useWhen: "building a general arithmetic or math practice page",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "one-page-mini-book",
    title: "One-page fold-into-eight mini book",
    useWhen: "building a one-page mini book that folds into eight panels",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "matching-visual-discrimination",
    title: "Preschool matching / visual discrimination page",
    useWhen:
      "building a preschool matching, sorting, or visual discrimination page",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "unit-study-packet",
    title: "Themed unit study packet",
    useWhen: "building a themed, multi-activity unit study packet",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "activity-pack",
    title: "Four-quadrant activity pack",
    useWhen: "building a themed activity pack of four mini-activities in quadrants",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "daily-rhythm-cards",
    title: "Daily rhythm / schedule cards",
    useWhen: "building cut-apart daily schedule or rhythm cards",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "visual-schedule-cards",
    title: "Visual schedule cards",
    useWhen: "building visual schedule cards for routines or transitions",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "singapore-workbook-page",
    title: "Singapore-style CPA math workbook page",
    useWhen:
      "building a Singapore-style workbook page using the concrete-pictorial-abstract progression",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "hive-puzzle",
    title: "Hexagonal hive constraint puzzle",
    useWhen: "building a hexagonal hive number-constraint puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "cross-number-puzzle",
    title: "Cross-number arithmetic puzzle",
    useWhen: "building a cross-number (crossword-style) arithmetic puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "fraction-link-puzzle",
    title: "Fraction-equivalence link puzzle",
    useWhen: "building a fraction-equivalence or fraction-link grid puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "fraction-maze-escape",
    title: "Fraction-comparison maze",
    useWhen: "building a fraction-comparison or ordering maze",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "decimal-path-puzzle",
    title: "Decimal-ordering path puzzle",
    useWhen: "building a decimal comparison or ordering path puzzle",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "geometry-maze",
    title: "Geometry / angle maze",
    useWhen: "building a geometry or angle maze, or a maze-style practice page",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "letter-number-formation-practice",
    title: "Letter / number formation practice page",
    useWhen:
      "building a letter or number formation practice page: a model letter or digit with a stroke cue, and a row of trace repetitions",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "art-project-instructions",
    title: "Art project instructions page",
    useWhen:
      "building an art, craft, or hands-on science project page with a materials list, numbered steps, and an optional inspiration thumbnail or reflection box",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "artist-composer-study-card",
    title: "Artist study portfolio card",
    useWhen:
      "building an artist, composer, or inventor study portfolio card with a name banner, blank artwork frame, 'where they were from' circle, favorite-work box, and stem-sentence reflection box",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "biography-timeline-page",
    title: "Biography timeline page",
    useWhen:
      "building a biography or invention-progression timeline page with 5-8 connected event boxes",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "chant-and-rhyme-card",
    title: "Chant and rhyme card",
    useWhen:
      "building a read-aloud chant, rhyme, or fingerplay performance card with cue chips and a parent footer",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "chart-and-graph-skill-practice",
    title: "Reading a bar graph practice page",
    useWhen:
      "building a one-skill chart or graph reading page (bar graph, calendar, timeline, or plain labeled diagram) with a small worked example, a larger practice display, and 2-4 questions answered from the display",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "checklist-assessment",
    title: "Readiness checklist page",
    useWhen:
      "building a parent-facing whole-child readiness or observation checklist with domain headers and Not Yet / Sometimes / Consistently columns",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "child-assisted-recipe-card",
    title: "Child-assisted recipe card",
    useWhen:
      "building a one-page cooking guide with an ADULT FIRST safety strip and picture-supported numbered CHILD steps",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "circle-diagram-two-set-sort",
    title: "Two-circle Venn sort page",
    useWhen:
      "building a two-circle Venn diagram sorting page with category labels outside each rim and an item bank",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "classification-sorting-mat",
    title: "Insect sorting mat",
    useWhen:
      "building a classification sorting mat: a laminate-and-reuse T-chart or multi-column mat on top with a dashed-border grid of cut-out pieces below",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "clip-cards",
    title: "Counting clip cards page",
    useWhen:
      "building a clip-card page: a 2-column grid of cards with a target on top and three answer choices along the bottom edge for a clothespin",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "cloze-story",
    title: "Cloze story page",
    useWhen:
      "building a fill-in-the-blank story page with a word bank (cloze story), ages 5-10, vocabulary or sight words in context",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "comic-narrative-math-page",
    title: "Comic narrative math page",
    useWhen:
      "building a comic-narrative-math-page: a 2x2 comic strip where two original characters talk a concept through in speech bubbles, closing in a visually distinct STOP AND TRY IT box whose question reuses the same characters and scenario",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "composer-listening-guide",
    title: "Composer listening guide",
    useWhen:
      "building a one-page active-listening companion for a single piece of music (title block, one listen-for hook, 3 to 5 checkbox moment boxes with sketch areas, feeling-response line)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "copy-work-pages",
    title: "Copy-work print page",
    useWhen:
      "building a handwriting copy-work page with a model passage in a bordered box and empty three-line guide rows below",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "curiosity-led-notebook-page",
    title: "Curiosity-led notebook page",
    useWhen:
      "building a curiosity-led notebook page: a mostly blank weekly reading-response sheet with one broad theme title, one invitation line, a dominant open unruled canvas box, and a few optional writing lines plus a Book blank underneath",
    register: "restrained",
    mediaType: JPEG,
  },
  {
    id: "cut-and-assemble-craft",
    title: "Stand-up Earth craft sheet",
    useWhen:
      "building a cut-and-assemble craft page: labeled flat cutout pieces with dashed cut borders, dotted fold lines, gray glue tabs, and a numbered assembly-step panel",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "decodable-story-page",
    title: "Decodable story page",
    useWhen:
      "building a decodable phonics story page (the child page of a two-page decodable-story packet) with big Andika-style text, reread circles, and a talk prompt",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "dictation-writing-practice",
    title: "Dictation child writing page",
    useWhen:
      "building a dictation writing practice packet whose child page is numbered blank writing lines, a sentence line, and an open response box",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "dot-marker-activity",
    title: "Dot-marker letter A page",
    useWhen:
      "building a dot-marker / bingo-dauber stamping page where large empty circles form a letter, number, or shape for ages 2-4",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "file-folder-game",
    title: "Animal homes file-folder game",
    useWhen:
      "building a file-folder game: a board page with labeled dashed drop zones plus a matching page of same-size cut-out pieces, glued inside a manila folder",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "flash-cards",
    title: "Phonics flash card sheet",
    useWhen:
      "building a cut-apart flash card deck page (2 by 2 cards with dashed cut lines, one big prompt per card, tiny deck id, parent note)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "grapheme-marking-practice",
    title: "Grapheme marking practice page",
    useWhen:
      "building a grapheme marking practice child page (read a word, underline the letters for each sound, one modeled example, six to ten practice rows on generous baselines)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "guided-notes",
    title: "Guided notes page",
    useWhen:
      "building a two-column Cornell-style guided notes page with key terms on the left, fill-in-the-blank notes on the right, and a summary box",
    register: "restrained",
    mediaType: JPEG,
  },
  {
    id: "labeled-anatomy-diagram",
    title: "Labeled anatomy diagram",
    useWhen:
      "building a labeled anatomy or parts diagram with numbered leader lines and a word bank (body systems, animal or plant anatomy, map labeling)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "lesson-comprehension-check",
    title: "Lesson comprehension check box",
    useWhen:
      "building a boxed 'What Did You Learn?' lesson closer with two recall questions and one Think and Share question",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "magic-square-puzzle",
    title: "Magic square puzzle page",
    useWhen:
      "building a magic-square puzzle worksheet (3x3 grid, some givens, one target sum stated once, faint diagonal hints, optional historical aside, no decoration)",
    register: "restrained",
    mediaType: JPEG,
  },
  {
    id: "name-tracing-page",
    title: "Name tracing page",
    useWhen:
      "building a name tracing page: the child's name repeated on three-line writing guides, fading from dotted outline to pale fill to empty rows",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "narration-page",
    title: "Narration page",
    useWhen:
      "building a Charlotte Mason narration, journal, or discovery-log page: title/prompt header, one large empty illustration box, wide-ruled dictation lines below",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "nature-identification-poster",
    title: "Nature identification poster",
    useWhen:
      "building a field-guide wall poster with a labeled grid of watercolor species illustrations",
    register: "restrained",
    mediaType: JPEG,
  },
  {
    id: "nature-observation-journal",
    title: "Nature observation journal page",
    useWhen:
      "building a mostly-blank weekly nature-notebook page the child fills with their own drawing and observation notes after time outdoors",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "nomenclature-cards",
    title: "Nomenclature card sheet",
    useWhen:
      "building a Montessori three-part nomenclature card set (control cards, picture-only cards, label-only cards)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "notes-and-practice-bundle",
    title: "Notes-and-practice packet spread",
    useWhen:
      "building a two-page notes-and-practice packet: Cornell-style two-column guided notes with fill-in blanks on page 1 and a numbered drill practice page on page 2",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "pattern-extension-practice",
    title: "AB pattern rows page",
    useWhen:
      "building a repeating-pattern page (AB or AAB/ABB/ABC) where the child copies, continues, circles what comes next, or creates a sequence in a row of shape cells",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "phoneme-letter-building-mat",
    title: "Phoneme-letter building mat",
    useWhen:
      "building a reusable sound-position mat page (child mat, page 1 of the phoneme-letter building packet) for segmenting and blending a taught word pattern",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "phonics-pattern-reference-chart",
    title: "Phonics pattern reference chart",
    useWhen:
      "building a one-pattern phonics reference chart with grouped example words and the target letters highlighted",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "phonics-sound-card-game",
    title: "Sound match card fronts",
    useWhen:
      "building a phonics sound card game: a cut-apart page of word cards forming closed pairs or families by one taught sound-spelling relationship",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "phonics-spelling-diagnostic-assessment",
    title: "Quick skill check child page",
    useWhen:
      "building a phonics or spelling skill-check child page (Form A/B word list, one big word per ruled row, no answers)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "picture-bingo-board",
    title: "Picture bingo board",
    useWhen:
      "building a picture or word bingo board set with a shared item pool, a labeled free space, and a caller list",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "picture-supported-syllable-ordering",
    title: "Syllable ordering cards",
    useWhen:
      "building a picture-supported Spanish syllable ordering page with scrambled syllable chips and a whole-word writing box",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "playdough-mat",
    title: "Playdough mat page",
    useWhen:
      "building a playdough mat with 2 to 4 very large thick-outlined letters, numbers, or shapes for a child to form with playdough",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "reader-theater-script",
    title: "Reader theater script page",
    useWhen:
      "building a reader theater script page with a cast list, bold speaker labels, italic bracketed stage directions, highlighted ALL choral lines, and a parent practice note",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "reading-comprehension-mini-unit",
    title: "Reading mini-unit passage page",
    useWhen:
      "building a magazine-style reading comprehension passage page with an illustration, a vocabulary sidebar, and a short question block (the reading-comprehension-mini-unit packet)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "size-attribute-comparison-page",
    title: "Size attribute comparison page",
    useWhen:
      "building a size attribute comparison page where a child circles, colors, or draws the longer, taller, bigger, or heavier of two or three illustrated items",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "social-narrative",
    title: "Social story page",
    useWhen:
      "building a first-person social narrative page (illustration on top, 2-3 big sentences below) for ages 3-8",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "then-and-now-comparison",
    title: "Then and now comparison page",
    useWhen:
      "building a two-panel then-and-now (long ago and today) comparison page with one illustration and caption per panel and a reflection question",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "word-fluency-repeated-reading",
    title: "Read-it-again word grid",
    useWhen:
      "building a repeated-reading word practice page (child page of a word-fluency packet) with one closed word set in large boxed cells and untimed round markers",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "counting-and-manipulative-mat",
    title: "Counting mat theme object",
    useWhen:
      "building a counting-and-manipulative-mat's single generated theme object for the hybrid path (one small line-art object on white, no text, sized for a label band or corner)",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "daily-calendar-weather-board",
    title: "Daily calendar and weather board",
    useWhen:
      "building a reusable circle-time calendar and weather board where the child circles today's day, date, season, and weather in place on one page",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "giant-letter-art-page",
    title: "Giant letter art page",
    useWhen:
      "building a giant letter art page: one page-filling capital and lowercase pair (or a single capital) drawn as a single thick uniform outline with an empty interior for a child to decorate, cut out, and keep in an alphabet portfolio",
    register: "playful",
    mediaType: JPEG,
  },
  {
    id: "illustrated-teaching-page",
    title: "Illustrated teaching page",
    useWhen:
      "building an illustrated teaching page: the text-free landscape illustration band under a child's question headline, one line-art subject that shows the sentences' exact claim on plain cream paper",
    register: "playful",
    mediaType: JPEG,
  },
];

const BY_ID: ReadonlyMap<string, MaterialAnchor> = new Map(
  REGISTRY.map((anchor) => [anchor.id, anchor]),
);

export function listStudioAnchors(): readonly MaterialAnchor[] {
  return REGISTRY;
}

export function studioAnchorIds(): readonly string[] {
  return REGISTRY.map((anchor) => anchor.id);
}

export function getStudioAnchor(id: string): MaterialAnchor | undefined {
  return BY_ID.get(id);
}

type ManifestEntry = (typeof ANCHOR_MANIFEST)[string];

/**
 * One anchor's manifest entry, only when the id is registered AND the
 * recorded URL passes isFleetAnchorUrl. The manifest is generated code,
 * but the URL check stays: a hand edit or a corrupted build must never
 * turn this path into an arbitrary fetch.
 */
function trustedManifestEntry(id: string): ManifestEntry | null {
  if (!BY_ID.has(id)) return null;
  if (!Object.hasOwn(ANCHOR_MANIFEST, id)) return null;
  const entry = ANCHOR_MANIFEST[id];
  return isFleetAnchorUrl(entry.url) ? entry : null;
}

/**
 * The public Blob URL for one registered anchor (the founder console links
 * to it), or null for anything that is not a registered, trusted anchor.
 */
export function studioAnchorUrl(id: string): string | null {
  return trustedManifestEntry(id)?.url ?? null;
}

/**
 * Well inside TOOL_DEADLINE.generate (240s): generate_image loads its
 * anchors in parallel, so the worst case adds one 10s timeout to a call
 * whose generation budget is 200s. A healthy fetch of a roughly 100 KB
 * JPEG from Blob is well under a second.
 */
const ANCHOR_FETCH_TIMEOUT_MS = 10_000;

/** Verified bytes per anchor id, so a warm instance fetches each once. */
const loadedAnchors = new Map<string, Uint8Array>();

/**
 * Resolves one anchor id to its verified JPEG bytes: registry lookup,
 * manifest lookup, isFleetAnchorUrl, a bounded fetch, the reference byte
 * cap (checked against Content-Length before the body is read, and again
 * on the bytes), and a sha256 check against the manifest. Any failure
 * returns null (with one runtime log line, the per-turn diagnostics
 * surface) so the caller can turn it into a model-readable note instead
 * of a thrown turn; nothing here throws. Only successes are memoized, for
 * the life of the isolate. `options.timeoutMs` exists for tests that need
 * a deterministic timeout; production callers take the default.
 */
export async function loadStudioAnchorBytes(
  id: string,
  options: { timeoutMs?: number } = {},
): Promise<Uint8Array | null> {
  const cached = loadedAnchors.get(id);
  if (cached) return cached;
  const entry = trustedManifestEntry(id);
  if (!entry) return null;

  const reject = (reason: string): null => {
    console.warn(`loadStudioAnchorBytes: anchor "${id}" ${reason}`);
    return null;
  };
  if (entry.bytes > MAX_REFERENCE_BYTES) {
    return reject(`is over the reference byte cap in the manifest (${entry.bytes} bytes)`);
  }
  try {
    const response = await fetch(entry.url, {
      signal: AbortSignal.timeout(options.timeoutMs ?? ANCHOR_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) return reject(`fetch returned HTTP ${response.status}`);
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REFERENCE_BYTES) {
      return reject(`declares Content-Length ${declaredLength}, over the reference cap`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength === 0) return reject("fetch returned no bytes");
    if (bytes.byteLength > MAX_REFERENCE_BYTES) {
      return reject(`fetch returned ${bytes.byteLength} bytes, over the reference cap`);
    }
    if (bytes.byteLength !== entry.bytes) {
      return reject(`fetch returned ${bytes.byteLength} bytes, manifest says ${entry.bytes}`);
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== entry.sha256) return reject("sha256 does not match the manifest");
    loadedAnchors.set(id, bytes);
    return bytes;
  } catch (error) {
    return reject(
      `fetch failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Every anchor id the manifest carries (for parity checks/tests). */
export function manifestAnchorIds(): readonly string[] {
  return Object.keys(ANCHOR_MANIFEST);
}
