import { z } from "zod";

export const handwritingPredecessorSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("guided").describe("A server-composed row in the exact revisesId material."),
    page: z.int().min(1).max(12).describe("Saved physical page, counted from 1."),
    rowId: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/).describe("Exact saved row input ID. The server verifies its receipt and printed dimensions."),
  }).strict(),
  z.object({
    kind: z.literal("legacy-svg").describe("A selected old SVG row, verified from the exact saved source and embedded font. This is a guide-alignment correction, not preservation of faulty glyph ink."),
    page: z.int().min(1).max(12).describe("Saved physical page, counted from 1. Legacy conversions stay on this page."),
    svgOrdinal: z.int().min(1).max(96).describe("SVG element ordinal within that saved page body, counted from 1, including decorative SVGs. Only an exact supported guide row is accepted."),
  }).strict(),
]).optional().describe("For a replacement row, select its predecessor in revisesId. Never invent dimensions or claim a missing old row is new. New extra rows may omit this after all retained old guided rows are accounted for.");

export type HandwritingPredecessor = NonNullable<z.infer<typeof handwritingPredecessorSchema>>;
