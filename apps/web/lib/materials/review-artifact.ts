import { generateObject } from "ai";
import { z } from "zod";

import {
  gatewayAttribution,
  recordModelUsage,
  type UsageChannel,
} from "../model-usage";

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
families before a parent sees them. You receive the rendered page images
(in page order) and the brief they were made from. Judge ONLY what a
parent would notice on paper:

- misspelled words, garbled or illegible text, wrong child name spelling
- the requested character, theme, or subject missing or wrong
- broken layout: overlapping or cut-off elements, a mostly blank page
- exercises that contradict the brief (wrong letter, wrong count, wrong
  difficulty for the stated age)

When told the document has more pages than you were shown, judge only
the pages you can see; never report unshown pages as missing or broken.
Do not nitpick style, art taste, or things the brief never asked for.
A usable page passes. List issues concretely, each one fixable, naming
the page number when there is more than one page.`;

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
  previewJpegs: readonly Buffer[];
  pageCount: number;
  brief: string;
  // The calling eve session, so review spend attributes to the session that
  // caused it (agent-jobs cost attribution). Optional and null-safe, same as
  // generateStudioImage.
  sessionId?: string | null;
}): Promise<ArtifactReview | null> {
  if (!reviewEnabled()) return null;
  if (input.previewJpegs.length === 0) return null;

  const model = reviewModelId();
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REVIEW_TIMEOUT_MS);

  const shownPages = input.previewJpegs.slice(0, REVIEW_PAGE_CAP);
  const pageContext =
    input.pageCount > 1
      ? `The document has ${input.pageCount} pages; you are shown page 1 through page ${shownPages.length}.\n`
      : "";

  try {
    const result = await generateObject({
      model,
      schema: reviewSchema,
      system: REVIEW_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            ...shownPages.map((data) => ({
              type: "file" as const,
              mediaType: "image/jpeg" as const,
              data,
            })),
            { type: "text", text: `${pageContext}The brief:\n${input.brief}` },
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
      sessionId: input.sessionId ?? null,
    });

    return { pass: result.object.pass, issues: result.object.issues };
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
