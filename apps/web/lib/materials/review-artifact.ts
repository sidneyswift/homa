import { generateObject } from "ai";
import { z } from "zod";

import {
  gatewayAttribution,
  recordModelUsage,
  type UsageChannel,
} from "../model-usage";
import { geometryReviewBlock, type PageGeometry } from "./page-geometry";
import type { RecipeChecklistItem } from "./recipe-checklist";
import type {
  ReviewAnchor,
  ReviewAnchorLoad,
  ReviewAnchorSkip,
} from "./review-anchor";
import {
  CHECKLIST_ANSWERS,
  verifyChecklistAnswers,
  type ChecklistAnswer,
  type ChecklistVerdict,
} from "./review-checklist";

/**
 * The studio's own eyes (MS-5): before a rendered page reaches the
 * parent, a cheap multimodal model looks at the actual pixels against
 * the brief and reports what a parent would notice. The main agent never
 * sees images in tool results, so this pass is how "look at the result,
 * critique it, regenerate if needed" (founder direction 2026-07-10)
 * happens inside one turn. The agent stays the decision-maker: the tool
 * returns the verdict and the agent chooses to revise or deliver.
 *
 * Failure posture: a review that cannot run returns null and never
 * blocks a creation; the parent's own critique remains the outer loop.
 * Cost control: HOMA_MATERIALS_REVIEW=off disables the pass fleet-wide;
 * HOMA_REVIEW_MODEL swaps the model (default a cheap vision tier).
 */

const DEFAULT_REVIEW_MODEL = "openai/gpt-5.4-mini";
const REVIEW_TIMEOUT_MS = 45_000;

/** Pages shown to the reviewer per call (input-token ceiling). */
export const REVIEW_PAGE_CAP = 4;

/**
 * Hard ceiling on pages reviewed for one creation, across all calls.
 * The longest material production has ever produced is 12 pages
 * (2026-07-30), so this bounds a pathological document rather than
 * describing a real one. Chunks run concurrently, so the ceiling costs
 * calls, not wall-clock, and create_printable's render deadline tier
 * has room: p95 37.5s, max 105s against 210s.
 */
export const REVIEW_MAX_PAGES = 16;

export function reviewEnabled(): boolean {
  return process.env.HOMA_MATERIALS_REVIEW !== "off";
}

/**
 * Full coverage (gh#368) is on unless switched off. Measured before
 * enabling rather than estimated: 1.45x reviewer calls and 1.71x page
 * images fleet-wide, against the roughly 3x the ticket feared, because
 * 155 of 227 materials are already four pages or shorter.
 */
export function reviewFullCoverageEnabled(): boolean {
  return process.env.HOMA_MATERIALS_REVIEW_FULL !== "off";
}

export function reviewModelId(): string {
  return process.env.HOMA_REVIEW_MODEL ?? DEFAULT_REVIEW_MODEL;
}

export interface ArtifactReview {
  /**
   * The blocking verdict, and only ever a statement about the pages in
   * the blocking chunk (see planReviewChunks). A problem found by the
   * coverage gh#368 added never flips this to false: founder ruling
   * 2026-07-30, full coverage tells her about a later page rather than
   * withholding the document over it.
   */
  pass: boolean;
  issues: string[];
  /**
   * Problems on pages that had no reviewer at all before gh#368. Real
   * and named, carried to the parent beside the material instead of
   * held back. Each entry already names its page: the reviewer is told
   * the page numbers it is looking at, and the chunk boundaries are
   * deterministic, so attribution never depends on parsing the text.
   */
  advisoryIssues: string[];
  /**
   * The 1-based page numbers the reviewer actually looked at. A pass is
   * a statement about these pages and nothing else, so the caller can
   * report coverage honestly instead of implying the whole document was
   * checked (gh#346).
   */
  reviewedPages: number[];
  /**
   * The recipe checklist as the blocking chunk answered it (2026-09-02):
   * every item with the reviewer's closed answer, joined to the item's
   * check text so the record survives a recipe rewording, and the ids of
   * blocking items answered no. Null when the material named no recipe
   * or its recipe declares no checklist. Stored in generation.review, so
   * a format's per-item pass rate is measurable per recipe.
   */
  checklist: {
    recipe: string | null;
    answers: ChecklistVerdict["answers"];
    blockingFailures: string[];
  } | null;
  /**
   * Whether the reviewer was shown the format's fleet anchor beside the
   * pages (review-anchor.ts). False never blocks anything; anchorSkipped
   * says why, so a review made without its size reference is auditable.
   */
  anchorShown: boolean;
  anchorSkipped?: ReviewAnchorSkip;
}

/** One rendered page offered to the reviewer. */
export interface ReviewablePage {
  data: Buffer;
  /** 1-based, the way the parent counts pages. */
  pageNumber: number;
  /**
   * Authored on this call rather than carried over unchanged. On a
   * revision these are the pages she asked about, and they are selected
   * first: reviewing pages 1 to 4 of a packet whose changed page is
   * page 5 checks precisely the pages nobody touched.
   */
  fresh: boolean;
}

/**
 * Up to REVIEW_PAGE_CAP pages, changed pages first, then the rest in
 * order. The selection is returned in reading order so page numbers in
 * the reviewer's issues stay meaningful.
 */
export function selectPagesForReview(
  pages: readonly ReviewablePage[],
  cap: number = REVIEW_PAGE_CAP,
): ReviewablePage[] {
  const fresh = pages.filter((page) => page.fresh);
  const carried = pages.filter((page) => !page.fresh);
  // All-fresh (every first build, and any revision that retyped the
  // whole packet) falls through to plain document order.
  const ordered = fresh.length === pages.length ? [...pages] : [...fresh, ...carried];
  return ordered
    .slice(0, cap)
    .sort((left, right) => left.pageNumber - right.pageNumber);
}

/** One creation's reviewer calls, split by what their verdict may do. */
export interface ReviewChunkPlan {
  /**
   * Exactly the pages the single-call reviewer saw before full
   * coverage, so its verdict keeps its old power to hold a document
   * back. Defined by calling selectPagesForReview rather than by
   * restating its rule, which is what makes "no page becomes newly
   * blocking" true by construction instead of by inspection. It matters
   * on a revision, where the old selection was changed-pages-first and
   * not pages one to four.
   */
  blocking: ReviewablePage[];
  /** Everything else, in reading order, in reviewer-sized batches. */
  advisory: ReviewablePage[][];
}

export function planReviewChunks(
  pages: readonly ReviewablePage[],
): ReviewChunkPlan {
  const blocking = selectPagesForReview(pages);
  if (!reviewFullCoverageEnabled()) return { blocking, advisory: [] };

  const alreadyShown = new Set(blocking.map((page) => page.pageNumber));
  const rest = pages
    .filter((page) => !alreadyShown.has(page.pageNumber))
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .slice(0, Math.max(0, REVIEW_MAX_PAGES - blocking.length));

  const advisory: ReviewablePage[][] = [];
  for (let start = 0; start < rest.length; start += REVIEW_PAGE_CAP) {
    advisory.push(rest.slice(start, start + REVIEW_PAGE_CAP));
  }
  return { blocking, advisory };
}

/** What one reviewer call returns, before code verifies it. */
interface ChunkModelOutput {
  pass: boolean;
  issues: string[];
  checklist?: ChecklistAnswer[];
}

/**
 * buildChunkSchema(checklist): the reviewer's output contract for one
 * call. The base verdict is unchanged; when the material's recipe
 * declares a checklist, the schema adds one closed answer per item, ids
 * drawn from the recipe (never free text), so the model chooses among
 * yes, no, and cannot_tell and code decides what each means
 * (review-checklist.ts). Exported for the contract test.
 */
export function buildChunkSchema(
  checklist: readonly RecipeChecklistItem[],
): z.ZodType<ChunkModelOutput> {
  const base = {
    pass: z
      .boolean()
      .describe("true unless a parent would notice a real problem on paper"),
    issues: z
      // 600, not 200: the old cap cut verdicts mid-sentence (Story's
      // failed letter page, 2026-08-21), losing the reasoning an audit
      // of QC decisions needs. Still bounded; six issues stay plenty.
      .array(z.string().max(600))
      .max(6)
      .describe("Concrete, fixable problems, empty when pass is true"),
  };
  if (checklist.length === 0) return z.object(base);
  const ids = checklist.map((item) => item.id) as [string, ...string[]];
  return z.object({
    ...base,
    checklist: z
      .array(
        z.object({
          id: z.enum(ids),
          answer: z.enum(CHECKLIST_ANSWERS),
          note: z
            .string()
            .max(200)
            .describe(
              "For no or cannot_tell only: what you saw, one sentence, naming the page when more than one is shown. Empty for yes.",
            ),
        }),
      )
      .min(1)
      .max(checklist.length)
      .describe("One entry per checklist item, every id answered."),
  });
}

const REVIEW_SYSTEM = `You quality-check printable pages for homeschooling
families before a parent sees them. Each image is an 8.5x11in printed
sheet: judge it as a page a parent holds in her hands and a child writes
on, not as a screen layout. You receive the rendered page images (in page
order) and the brief they were made from. Judge ONLY what a parent would
notice on paper:

- misspelled words, garbled or illegible text, wrong child name spelling
- the requested character, theme, or subject missing or wrong
- broken layout: overlapping or cut-off elements, a mostly blank page
- exercises that contradict the brief (wrong letter, wrong count, wrong
  difficulty for the stated age)
- a real photo that carries a visible watermark, stock-agency text or
  logo, or a sample/preview overlay: that reads on paper and a parent
  notices it immediately

When told the document has more pages than you were shown, judge only
the pages you can see; never report unshown pages as missing or broken.
Do not nitpick style, art taste, or things the brief never asked for.
A usable page passes. List issues concretely, each one fixable, naming
the page number when there is more than one page.

You may be given measured page geometry (fill percent, where content
ends, overflow past the page box). Those numbers come from the renderer,
so trust them over your own guess about SIZES AND POSITIONS from a
shrunken image. They say nothing about whether the page is any good:
judge that from what you can see. Overflow is always worth flagging: it
prints cut off. A deep blank band at the bottom is a real defect, not
design air, and it is a defect at every age (founder ruling
\`worksheet-scale-to-fill\`, 2026-07-29): the page should have been
scaled up to reach the bottom. Say so when you see one. The fix is
bigger type, taller answer blanks and larger pictures, never more
exercises crammed in, so do not ask for extra content.

When the brief carries a format checklist, it is the format's structural
spec: answer every item by its id, counting the things it counts and
comparing sizes against the model item on the same page rather than
guessing, and a no names the page number when more than one page is
shown. Answer cannot_tell only when the image genuinely cannot settle
the question.`;

interface ChunkVerdict {
  pass: boolean;
  issues: string[];
  /** Checklist notes that never hold a page back: advisory items answered
   * no, and items the reviewer could not settle. */
  advisory: string[];
  reviewedPages: number[];
  checklistAnswers: ChecklistVerdict["answers"];
}

/**
 * One reviewer call over one batch of pages, or null when it cannot
 * run. Every page handed in is shown: the batching decision belongs to
 * planReviewChunks, so a caller cannot silently drop a page here.
 */
async function reviewChunk(input: {
  familyId: string;
  channel: UsageChannel;
  pages: readonly ReviewablePage[];
  pageCount: number;
  brief: string;
  /**
   * Deterministic geometry (gh#349) for the pages in THIS chunk only.
   * It arrived when pages past the cap had no image and geometry was
   * the only fact available about them; now that every page is shown
   * (gh#368) each number rides beside its own picture, so the reviewer
   * can check the measurement against what it can see. Scoped per chunk
   * on purpose: a line about page 11 inside the call that reviews pages
   * 1 to 4 invites an issue filed against a page that call never saw.
   */
  pageGeometry?: readonly PageGeometry[];
  /** False for fixed-dimension formats (flash cards), whose leftover
   * band is the correct remainder of a real-world card size rather than
   * a page that failed to scale up. */
  underfillNotes?: boolean;
  /** The recipe's closed checklist (recipes.generated.ts), when the
   * material named a recipe that declares one. Never model-supplied. */
  checklist?: readonly RecipeChecklistItem[];
  /** The recipe slug, for the checklist heading in the prompt. */
  recipe?: string | null;
  /** The format's fleet anchor, shown after the pages as a size and
   * structure reference that is explicitly not under review. */
  anchor?: ReviewAnchor | null;
}): Promise<ChunkVerdict | null> {
  if (input.pages.length === 0) return null;

  const model = reviewModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);

  const shownPages = input.pages;
  const shownNumbers = shownPages.map((page) => page.pageNumber);
  const anchor = input.anchor ?? null;
  const shownList =
    shownNumbers.length === 1
      ? `page ${shownNumbers[0]}`
      : `pages ${shownNumbers.join(", ")}`;
  const thenAnchor = anchor ? ", then one reference image" : "";
  const pageContext =
    input.pageCount > 1
      ? `The document has ${input.pageCount} pages; you are shown ${shownList}${thenAnchor}, in that order. Number every issue by the page number given here, not by its position among the images.\n`
      : anchor
        ? `You are shown ${shownList}${thenAnchor}.\n`
        : "";
  const anchorContext = anchor
    ? `The last image is Homa's reference page for this format (${anchor.title}). It is not under review. It sets the bar for structure and size: the pages under review should be at least this generous in size and at least this clear. Different letters, words, theme, or child name are expected and are not issues.\n`
    : "";
  const geometryBlock = geometryReviewBlock(input.pageGeometry ?? [], {
    underfillNotes: input.underfillNotes,
  });
  const geometryContext = geometryBlock ? `${geometryBlock}\n` : "";
  const checklist = input.checklist ?? [];
  const checklistContext =
    checklist.length > 0
      ? `\n\nFormat checklist for "${input.recipe ?? "this format"}" (answer every item by id; yes means every page you see meets it; no means at least one shown page fails it; cannot_tell only when the image genuinely cannot settle it):\n${checklist
          .map((item) => `- ${item.id}: ${item.check}`)
          .join("\n")}`
      : "";

  try {
    const result = await generateObject({
      model,
      schema: buildChunkSchema(checklist),
      system: REVIEW_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...shownPages.map((page) => ({
              type: "file" as const,
              mediaType: "image/jpeg" as const,
              data: page.data,
            })),
            // The anchor rides AFTER the pages so page numbering in the
            // reviewer's issues stays aligned with the images it counts.
            ...(anchor
              ? [
                  {
                    type: "file" as const,
                    mediaType: anchor.mediaType,
                    data: anchor.data,
                  },
                ]
              : []),
            {
              type: "text",
              text: `${pageContext}${anchorContext}${geometryContext}The brief:\n${input.brief}${checklistContext}`,
            },
          ],
        },
      ],
      // Each checklist answer costs a few dozen tokens; the cap keeps a
      // full eight-item answer inside the budget without opening the
      // door to an essay.
      maxOutputTokens: Math.min(1_100, 600 + 60 * checklist.length),
      maxRetries: 1,
      abortSignal: controller.signal,
      providerOptions: {
        gateway: {
          ...gatewayAttribution(input.familyId, "materials_review"),
          disallowPromptTraining: true,
        },
      },
    });

    await recordModelUsage({
      familyId: input.familyId,
      surface: "materials_review",
      channel: input.channel,
      model,
      modality: "text",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: Date.now() - startedAt,
    });

    // The model judged; code decides what its checklist answers mean.
    // A blocking item answered no fails the chunk even when the model's
    // own pass was true: the checklist is the format's spec, and the
    // free-form verdict has already missed exactly these defects once.
    const checklistVerdict = verifyChecklistAnswers(
      checklist,
      result.object.checklist,
    );
    return {
      pass: result.object.pass && checklistVerdict.pass,
      issues: [...result.object.issues, ...checklistVerdict.issues],
      advisory: checklistVerdict.advisory,
      reviewedPages: shownNumbers,
      checklistAnswers: checklistVerdict.answers,
    };
  } catch (error) {
    if (controller.signal.aborted) return null;
    console.error(
      "reviewArtifact chunk failed (those pages go unreviewed):",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * reviewArtifact(...): a verdict, or null when review is off or the
 * blocking chunk could not run (null never blocks delivery). Multi-page
 * materials pass every rendered page plus the true pageCount, so the
 * reviewer never mistakes "I was shown one page" for "the document has
 * one page" (the Llanes packet incident, 2026-07-17).
 *
 * Chunks run concurrently. Sequentially they would not fit: the review
 * call's own ceiling is 45s and production has seen a single call take
 * 15.6s, so three sequential chunks could outlast the ceiling on their
 * own before create_printable's render work is counted at all.
 *
 * Null when the BLOCKING chunk fails, even if advisory chunks came
 * back. It is the one honest answer: the caller turns null into "nothing
 * has looked at these pages", and reporting a page-nine problem while
 * silent about pages one to four would make that sentence a lie in the
 * direction that matters.
 */
export async function reviewArtifact(input: {
  familyId: string;
  channel: UsageChannel;
  pages: readonly ReviewablePage[];
  pageCount: number;
  brief: string;
  /** Measured geometry for every rendered page (gh#349). Handed to each
   * chunk sliced to that chunk's own pages. */
  pageGeometry?: readonly PageGeometry[];
  /** False for fixed-dimension formats (flash cards); spread into every
   * chunk call below. */
  underfillNotes?: boolean;
  /** The recipe's closed checklist, resolved by the caller from
   * recipes.generated.ts; spread into every chunk call. */
  checklist?: readonly RecipeChecklistItem[];
  /** The recipe slug the checklist belongs to. */
  recipe?: string | null;
  /** The format's anchor load (review-anchor.ts), or the reason there is
   * none. Absent means no anchor was even sought. */
  anchor?: ReviewAnchorLoad | null;
}): Promise<ArtifactReview | null> {
  if (!reviewEnabled()) return null;
  if (input.pages.length === 0) return null;

  const geometryFor = (chunk: readonly ReviewablePage[]) => {
    if (!input.pageGeometry?.length) return undefined;
    const shown = new Set(chunk.map((page) => page.pageNumber));
    return input.pageGeometry.filter((entry) => shown.has(entry.page));
  };

  const anchor = input.anchor?.anchor ?? null;
  const chunkInput = { ...input, anchor };
  const { blocking, advisory } = planReviewChunks(input.pages);
  const [blockingVerdict, ...advisoryVerdicts] = await Promise.all([
    reviewChunk({ ...chunkInput, pages: blocking, pageGeometry: geometryFor(blocking) }),
    ...advisory.map((pages) =>
      reviewChunk({ ...chunkInput, pages, pageGeometry: geometryFor(pages) }),
    ),
  ]);

  if (!blockingVerdict) return null;

  const landed = advisoryVerdicts.filter(
    (verdict): verdict is ChunkVerdict => verdict !== null,
  );
  const checklist = input.checklist ?? [];
  return {
    pass: blockingVerdict.pass,
    issues: blockingVerdict.issues,
    // The blocking chunk's own advisory checklist notes ride here too:
    // an advisory no or a cannot_tell on the pages she asked about is
    // still worth a sentence to her, it just never withholds the page.
    advisoryIssues: [
      ...blockingVerdict.advisory,
      ...landed.flatMap((verdict) => [...verdict.issues, ...verdict.advisory]),
    ],
    // Only pages a reviewer actually returned on. A chunk that timed
    // out leaves its pages out, so the coverage sentence stays true.
    reviewedPages: [
      ...blockingVerdict.reviewedPages,
      ...landed.flatMap((verdict) => verdict.reviewedPages),
    ].sort((left, right) => left - right),
    checklist:
      checklist.length > 0
        ? {
            recipe: input.recipe ?? null,
            answers: blockingVerdict.checklistAnswers,
            blockingFailures: blockingVerdict.checklistAnswers
              .filter((answer) => answer.severity === "blocking" && answer.answer === "no")
              .map((answer) => answer.id),
          }
        : null,
    anchorShown: anchor !== null,
    ...(anchor === null
      ? { anchorSkipped: input.anchor?.skipped ?? "no-anchor" }
      : {}),
  };
}
