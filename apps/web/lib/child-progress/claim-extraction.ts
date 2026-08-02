import { generateObject } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import {
  gatewayAttribution,
  recordModelUsage,
  type UsageResourceKind,
} from "../model-usage";
import type { ClaimChild, ProposedClaim } from "./claim-validation";
import { renderSkillCatalog } from "./skill-catalog";

/**
 * The judgment half of "models judge, code verifies" (AGENTS.md).
 *
 * Reading a mother's sentence and deciding which skill it demonstrates
 * is a judgment call, so a model makes it. The model has no authority:
 * everything it returns goes through claim-validation.ts, which
 * re-checks the skill against the bank, the child against the family,
 * and the quote against the parent's own words before anything reaches
 * the ledger. This module's only job is to produce well-formed
 * candidates and to fail closed.
 *
 * It replaced a token-overlap matcher with six alias rules that scored
 * one evidence row in the product's lifetime. See
 * docs/homa-planning/plans/2026-07-21-progress-signal-capture-audit.md.
 */

const claimSchema = z.object({
  /** Which child, by the id given in the roster. */
  childId: z.string().min(1),
  /** Which skill line, by id, copied from the catalog. */
  itemId: z.string().min(1),
  answer: z.enum(["easily", "getting_there", "not_yet"]),
  /**
   * The parent's own words backing this claim, copied exactly. The
   * validator re-checks this against the message, so a paraphrase is
   * dropped rather than trusted.
   */
  quote: z.string().min(1).max(400),
  /**
   * high: the message plainly states this child did this.
   * medium: strongly implied, or the skill is a close but not exact fit.
   * low: a guess. Never writes evidence; kept as an observation.
   */
  confidence: z.enum(["high", "medium", "low"]),
});

export const extractedClaimsSchema = z.object({
  /**
   * Empty whenever the message reports nothing about what a child can
   * do. Most messages are like this and that is the correct answer.
   */
  claims: z.array(claimSchema).max(12),
});

export type ExtractedClaims = z.infer<typeof extractedClaimsSchema>;

const EXTRACTION_SYSTEM = `You read one message a homeschooling parent
sent about her children and decide what, if anything, it reports about
what a specific child can or cannot do. You are the judgment step in a
pipeline: deterministic code re-checks everything you return, so your
job is to be accurate and honest, never to be generous.

Return one claim for each concrete ability a NAMED OR CLEARLY IMPLIED
child demonstrated or visibly could not do, choosing the skill line
from the catalog whose meaning actually matches. Match on meaning, not
on shared words: "she finished the counting page and got them all
right" is about counting, whatever words the catalog uses.

Rules that decide the answer field:
- easily: the message shows the child did it independently, or says so.
- getting_there: partial, with help, emerging, inconsistent, or the
  message does not say whether it was independent.
- not_yet: the message says the child could not do it, or refused, or
  needed it done for them.

Rules that decide confidence:
- high: the message plainly states this child did this thing.
- medium: strongly implied, or the closest catalog line is a near fit.
- low: you are inferring. Prefer low over stretching a match.

Hard rules:
- The quote field must be words copied EXACTLY from the message, the
  span that backs your claim. Never paraphrase and never quote words
  the message does not contain.
- Only children in the roster. Never another family's child, a cousin,
  a sibling not in the roster, or a child described in a question.
- A request, a plan, a question, product feedback, or a parent venting
  is NOT a report. Return an empty claims array for those.
- Time spent is not a skill ("we did 30 minutes of math" reports no
  ability). Return nothing for it.
- One family activity can produce a claim for each child who took part,
  but only when the message shows what THAT child actually did. Do not
  invent per-child detail the message does not contain; use low
  confidence when the activity is shared and the detail is thin.
- Prefer the catalog line closest to what the child actually did, even
  when a more impressive line shares more words. Under-crediting is
  recoverable; over-crediting corrupts the record.`;

export interface ClaimExtractionInput {
  familyId: string;
  message: string;
  children: readonly ClaimChild[];
  /** Where this message came from, for usage attribution only. */
  surface: "journal" | "lesson";
  resourceKind: Extract<UsageResourceKind, "conversation_message" | "lesson">;
  resourceId: string;
}

/**
 * extractProgressClaims(...): candidate claims for one message, or an
 * empty list. Fails closed: any model or parsing failure returns no
 * claims, so the caller records an observation instead of guessing.
 * Never throws, because losing the parent's message to an exception is
 * worse than recording it unscored.
 */
export async function extractProgressClaims(
  input: ClaimExtractionInput,
): Promise<ProposedClaim[]> {
  if (input.children.length === 0) return [];
  if (input.message.trim().length === 0) return [];

  const roster = input.children
    .map(
      (child) =>
        `  ${child.childId}  ${child.name}, ${Math.floor(child.ageMonths / 12)} years old ` +
        `(${child.ageMonths} months)`,
    )
    .join("\n");
  // The band is scoped from the oldest child so every child in the
  // roster is covered; the below-age reach is generous by design.
  const oldestAgeMonths = Math.max(
    ...input.children.map((child) => child.ageMonths),
  );
  const startedAt = Date.now();

  try {
    const result = await generateObject({
      model: HOMA_MODEL,
      schema: extractedClaimsSchema,
      system: EXTRACTION_SYSTEM,
      // Catalog FIRST, deliberately. It is the largest and most stable
      // block, and it is bucketed by age, so putting it ahead of the
      // per-family roster lets the provider cache the prefix across
      // every family with a child in the same year. Roster and message
      // (the parts that change every call) follow it.
      prompt: [
        `<skill_catalog>\n${renderSkillCatalog(oldestAgeMonths)}\n</skill_catalog>`,
        `<children>\n${roster}\n</children>`,
        `<message>\n${input.message.slice(0, 8_000)}\n</message>`,
      ].join("\n\n"),
      maxOutputTokens: 4_000,
      maxRetries: 1,
      providerOptions: {
        gateway: {
          disallowPromptTraining: true,
          ...gatewayAttribution(input.familyId, "progress_claim_extraction"),
        },
      },
    });

    await recordModelUsage({
      familyId: input.familyId,
      surface: "progress_claim_extraction",
      channel: "web",
      model: HOMA_MODEL,
      modality: "text",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: Date.now() - startedAt,
      resourceKind: input.resourceKind,
      resourceId: input.resourceId,
    });

    return result.object.claims;
  } catch (error) {
    console.error(
      "progress claim extraction failed (message rides as an observation):",
      error instanceof Error ? error.message : "unknown",
    );
    return [];
  }
}
