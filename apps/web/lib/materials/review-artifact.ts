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

export function reviewEnabled(): boolean {
  return process.env.HOMA_MATERIALS_REVIEW !== "off";
}

export function reviewModelId(): string {
  return process.env.HOMA_REVIEW_MODEL ?? DEFAULT_REVIEW_MODEL;
}

export interface ArtifactReview {
  pass: boolean;
  issues: string[];
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

const reviewSchema = z.object({
  pass: z
    .boolean()
    .describe("true unless a parent would notice a real problem on paper"),
  issues: z
    .array(z.string().max(200))
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
ends, overflow past the page box). Trust those numbers over your own
guess from the image. Overflow is always worth flagging: it prints cut
off. A low fill number is NOT automatically a defect: a spacious,
easy-to-read page for a young or beginning child is correct, not
underfilled. Only flag underfill when the brief's stated age or skill
level implies more should fit, or when the blank band reads as an
unfinished page rather than a deliberately spacious one.`;

/**
 * reviewArtifact(...): a verdict, or null when review is off or fails
 * (null never blocks delivery). Multi-page materials pass every rendered
 * page preview (REVIEW_PAGE_CAP applies) plus the true pageCount, so the
 * reviewer never mistakes "I was shown one page" for "the document has
 * one page" (the Llanes packet incident, 2026-07-17).
 */
export async function reviewArtifact(input: {
  familyId: string;
  channel: UsageChannel;
  pages: readonly ReviewablePage[];
  pageCount: number;
  brief: string;
  /** Deterministic geometry for every rendered page (gh#349), including
   * pages past REVIEW_PAGE_CAP that carry no image here: the reviewer
   * still gets an objective fact about them even with nothing to look
   * at. Optional so existing callers/tests are unaffected. */
  pageGeometry?: readonly PageGeometry[];
}): Promise<ArtifactReview | null> {
  if (!reviewEnabled()) return null;
  if (input.pages.length === 0) return null;

  const model = reviewModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);

  const shownPages = selectPagesForReview(input.pages);
  const shownNumbers = shownPages.map((page) => page.pageNumber);
  const pageContext =
    input.pageCount > 1
      ? `The document has ${input.pageCount} pages; you are shown ${
          shownNumbers.length === 1
            ? `page ${shownNumbers[0]}`
            : `pages ${shownNumbers.join(", ")}`
        }, in that order. Number every issue by the page number given here, not by its position among the images.\n`
      : "";
  const geometryBlock = geometryReviewBlock(input.pageGeometry ?? []);
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
      "reviewArtifact failed (creation proceeds unreviewed):",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
