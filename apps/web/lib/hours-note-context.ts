import { z } from "zod";

const scalarCount = (value: string) => Array.from(value).length;
const boundedText = (limit: number) => z.string().max(limit * 2).refine((value) => scalarCount(value) <= limit);
export const hoursWorkContextSchema = z.strictObject({
  sourceMessageId: z.uuid().transform((id) => id.toLowerCase()).describe("Canonical earlier parent message ID returned by recall. Never an assistant message or guessed ID."),
  sourceQuote: boundedText(1000).refine((value) => value.trim().length > 0).describe("Exact earlier parent-message span containing the work title."),
  workTitle: boundedText(300).refine((value) => value.trim().length > 0).describe("Exact named-work span inside the earlier source quote, not a paraphrase."),
});
export type HoursWorkContext = z.infer<typeof hoursWorkContextSchema>;

function clipGraphemes(value: string, limit: number): { text: string; truncated: boolean } {
  if (scalarCount(value) <= limit) return { text: value, truncated: false };
  if (limit < 1) return { text: "", truncated: true };
  let text = "", used = 0;
  for (const { segment } of new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value)) {
    const length = scalarCount(segment);
    if (used + length > limit - 1) break;
    text += segment; used += length;
  }
  return { text: text.trimEnd() + "…", truncated: true };
}

/** Bounded display annotation, never the provenance source.
 * Known owned Planner title or independently verified named-work title comes first.
 * Full immutable context must be stored separately by the operation writer.
 * Retains the existing 200-code-point Hours note contract. */
export function composeHoursNote(input: { title?: string | null; note?: string | null; sourceQuote: string }) {
  const quote = boundedText(1000).parse(input.sourceQuote);
  const title = boundedText(4000).nullable().optional().parse(input.title)?.trim() ?? "";
  const detail = boundedText(1000).nullable().optional().parse(input.note)?.trim() || quote.trim();
  const fullNote = title.length === 0 ? detail
    : detail === title || detail.startsWith(title + " · ") || detail.startsWith(title + ": ") ? detail
    : detail.length === 0 ? title : title + " · " + detail;
  // A title that fits is retained whole even when no room remains for detail.
  const clipped = title && scalarCount(title) <= 200 && scalarCount(title) >= 198 && scalarCount(fullNote) > 200
    ? { text: title, truncated: true } : clipGraphemes(fullNote, 200);
  return { ...clipped, fullContext: { title: title || null, note: detail || null, sourceQuote: quote } };
}
