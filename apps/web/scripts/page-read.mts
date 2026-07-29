import { readFile } from "node:fs/promises";

import { generateObject } from "ai";
import { z } from "zod";

/**
 * page-read.mts: read page images with a vision model, for the pages OCR
 * cannot do honestly.
 *
 * WHY THIS EXISTS:
 * book-intake.py runs tesseract over every page because it is free, fast,
 * and genuinely good at dense body text. It is bad at exactly the pages that
 * carry a book's identity: a stylised cover, a title page, display type over
 * artwork, handwriting, a diagram whose labels are set at angles. The first
 * real book proved it, turning "METRO READING / Fast Forward! / STUDENT
 * HANDBOOK" into "MET | Pacis | RO READING | HANDBOOK". Recording that as a
 * limitation was the wrong call: OCR and a vision model are complementary,
 * so the pipeline uses both and keeps the better answer per page.
 *
 * A vision model also returns what OCR structurally cannot: what the page
 * SHOWS. Illustration style, palette, layout shape, and whether art carries
 * meaning are all theming and aboutness evidence that no character-recognition
 * pass can produce.
 *
 * AUTH: Vercel OIDC, never a gateway API key (founder ruling 2026-07-27).
 * Locally that means a fresh VERCEL_OIDC_TOKEN in apps/web/.env.local
 * (`pnpm dev:token`, roughly twelve hours). No new credential is introduced.
 *
 * CONTRACT: stdin is JSON {model?, pages: [{page, path}]}; stdout is JSON
 * {pages: [{page, text, description, kind, confidence}]}. One page per
 * request element, order preserved. The caller decides which pages to send;
 * this script does not sample or skip.
 *
 * USAGE (normally invoked by book-intake.py):
 *   echo '{"pages":[{"page":1,"path":"/abs/p0001.jpeg"}]}' \
 *     | tsx apps/web/scripts/page-read.mts
 */

const DEFAULT_MODEL = "google/gemini-3-flash";

/**
 * A page the cheap model cannot return as structured output is retried once
 * on a stronger tier, which is the escalation the corpus plan describes.
 *
 * This is not hypothetical. Across the first 850 real pages, six escalated
 * pages came back "No object generated: could not parse the response" from
 * gemini-3-flash, and this repo has hit the same model's structured-output
 * weakness before (the lesson-listen tone model, 2026-07-21). Without the
 * retry those six pages silently kept their OCR text, and the pages that get
 * escalated are exactly the ones whose OCR text is worst.
 */
const FALLBACK_MODEL = "anthropic/claude-sonnet-5";

const pageSchema = z.object({
  text: z
    .string()
    .describe(
      "Every word visible on the page, transcribed verbatim in reading order. Include title text, headers, footers, page numbers, captions, labels, and copyright lines. Preserve the wording exactly; do not correct, summarise, translate, or reorder. Empty string only if the page truly has no text.",
    ),
  description: z
    .string()
    .describe(
      "What the page shows, in two or three sentences: layout shape, illustration style and palette, and whether the art carries meaning or decorates. This is the part OCR cannot produce.",
    ),
  kind: z
    .enum([
      "cover",
      "title",
      "toc",
      "instructional",
      "worksheet",
      "answer_key",
      "flashcard",
      "story",
      "illustration",
      "blank",
      "index",
      "ad",
      "other",
    ])
    .describe("What this page is, from the closed set."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "How confident you are that the transcription is complete and correct. Below 0.5 means the page is genuinely hard to read, not that it is sparse.",
    ),
});

const SYSTEM = [
  "You transcribe pages of scanned educational books for an archive.",
  "Transcribe what is on the page, verbatim. Never invent, complete, or tidy text.",
  "Stylised and display type still counts as text: read a cover's title exactly as printed.",
  "If part of the page is genuinely illegible, leave it out of the text and say so in the description rather than guessing at it.",
  "The transcription is used to verify quotes later, so accuracy matters far more than fluency.",
].join(" ");

interface RequestPage {
  page: number;
  path: string;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<number> {
  const raw = await readStdin();
  let request: { model?: string; pages: RequestPage[] };
  try {
    request = JSON.parse(raw);
  } catch {
    process.stdout.write(JSON.stringify({ error: "stdin was not valid JSON" }) + "\n");
    return 2;
  }
  const pages = request.pages ?? [];
  if (pages.length === 0) {
    process.stdout.write(JSON.stringify({ pages: [] }) + "\n");
    return 0;
  }

  const model = request.model ?? DEFAULT_MODEL;
  const results: unknown[] = [];

  // Sequential on purpose. This runs against a founder's local token on a
  // laptop, escalation is a small fraction of any book, and a burst of
  // parallel vision calls is how a rate limit turns one slow batch into a
  // failed one.
  const readOne = async (path: string, useModel: string) => {
    const data = await readFile(path);
    return generateObject({
      model: useModel,
      schema: pageSchema,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "file" as const, mediaType: "image/jpeg" as const, data },
            {
              type: "text" as const,
              text: "Transcribe this page and describe what it shows.",
            },
          ],
        },
      ],
      // A dense page is the whole reason this call exists, so the budget has
      // to fit the densest real one rather than a typical one. Measured: a
      // photo-credits page (hundreds of two-column credit lines, Your Health
      // p114) truncated its JSON mid-object at 3000 and surfaced as the
      // opaque "No object generated: could not parse the response" on BOTH
      // models, which reads like a model failure and is really a budget.
      maxOutputTokens: 12000,
      maxRetries: 2,
      providerOptions: {
        gateway: { disallowPromptTraining: true },
      },
    });
  };

  for (const page of pages) {
    let firstError = "";
    for (const useModel of [model, FALLBACK_MODEL]) {
      if (useModel === FALLBACK_MODEL && !firstError) break;
      try {
        const result = await readOne(page.path, useModel);
        results.push({ page: page.page, model: useModel, ...result.object });
        firstError = "";
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown error";
        if (!firstError) firstError = message;
        else firstError = `${firstError}; fallback also failed: ${message}`;
      }
    }
    if (firstError) {
      // One unreadable page must not lose the rest of the batch. The caller
      // keeps the tesseract text for a page reported here, and records that
      // the page was attempted so a failed read never looks like a page that
      // was simply never escalated.
      results.push({ page: page.page, error: firstError });
    }
  }

  process.stdout.write(JSON.stringify({ model, fallbackModel: FALLBACK_MODEL, pages: results }) + "\n");
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    process.stdout.write(
      JSON.stringify({ error: error instanceof Error ? error.message : "unknown" }) + "\n",
    );
    process.exit(1);
  },
);
