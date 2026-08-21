import { generateObject } from "ai";
import { z } from "zod";

import {
  gatewayAttribution,
  recordModelUsage,
  type UsageChannel,
} from "../model-usage";
import { geometryReviewBlock, type PageGeometry } from "./page-geometry";

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

const reviewSchema = z.object({
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
});

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
exercises crammed in, so do not ask for extra content.`;

interface ChunkVerdict {
  pass: boolean;
  issues: string[];
  reviewedPages: number[];
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
}): Promise<ChunkVerdict | null> {
  if (input.pages.length === 0) return null;

  const model = reviewModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);

  const shownPages = input.pages;
  const shownNumbers = shownPages.map((page) => page.pageNumber);
  const pageContext =
    input.pageCount > 1
      ? `The document has ${input.pageCount} pages; you are shown ${
          shownNumbers.length === 1
            ? `page ${shownNumbers[0]}`
            : `pages ${shownNumbers.join(", ")}`
        }, in that order. Number every issue by the page number given here, not by its position among the images.\n`
      : "";
  const geometryBlock = geometryReviewBlock(input.pageGeometry ?? [], {
    underfillNotes: input.underfillNotes,
  });
  const geometryContext = geometryBlock ? `${geometryBlock}\n` : "";

  try {
    const result = await generateObject({
      model,
      schema: reviewSchema,
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
            {
              type: "text",
              text: `${pageContext}${geometryContext}The brief:\n${input.brief}`,
            },
          ],
        },
      ],
      maxOutputTokens: 600,
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

    return {
      pass: result.object.pass,
      issues: result.object.issues,
      reviewedPages: shownNumbers,
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
}): Promise<ArtifactReview | null> {
  if (!reviewEnabled()) return null;
  if (input.pages.length === 0) return null;

  const geometryFor = (chunk: readonly ReviewablePage[]) => {
    if (!input.pageGeometry?.length) return undefined;
    const shown = new Set(chunk.map((page) => page.pageNumber));
    return input.pageGeometry.filter((entry) => shown.has(entry.page));
  };

  const { blocking, advisory } = planReviewChunks(input.pages);
  const [blockingVerdict, ...advisoryVerdicts] = await Promise.all([
    reviewChunk({ ...input, pages: blocking, pageGeometry: geometryFor(blocking) }),
    ...advisory.map((pages) =>
      reviewChunk({ ...input, pages, pageGeometry: geometryFor(pages) }),
    ),
  ]);

  if (!blockingVerdict) return null;

  const landed = advisoryVerdicts.filter(
    (verdict): verdict is ChunkVerdict => verdict !== null,
  );
  return {
    pass: blockingVerdict.pass,
    issues: blockingVerdict.issues,
    advisoryIssues: landed.flatMap((verdict) => verdict.issues),
    // Only pages a reviewer actually returned on. A chunk that timed
    // out leaves its pages out, so the coverage sentence stays true.
    reviewedPages: [
      ...blockingVerdict.reviewedPages,
      ...landed.flatMap((verdict) => verdict.reviewedPages),
    ].sort((left, right) => left - right),
  };
}
