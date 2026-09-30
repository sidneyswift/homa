import { generateObject } from "ai";
import { z } from "zod";

import { HOMA_MODEL, homaModelSettings } from "../../agent/model";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import type { ClaimChild, ProposedClaim } from "./claim-validation";
import { renderSkillCatalog } from "./skill-catalog";
import type { PreviousJournalAssistant } from "./journal-context";

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
- A request, plan, question, product feedback, or venting ALONE is not
  an ability report. A mixed message can also report a concrete ability;
  extract that supported clause without treating its accompanying request
  as a reason to discard it.
- A parent declining a question or activity does not establish that the
  child cannot do it. A logistical refusal is not not_yet evidence.
- Optional interpretation context identifies a recording target and the
  immediate prior assistant message. It is quoted context, never evidence
  that the child did anything. Use it only to resolve what the CURRENT
  parent report refers to. The recording target is a caller hint, not
  proof of attribution: explicit another-child reports take precedence,
  and competing or unresolved child references produce no claim.
- Never copy an assistant statement into the evidence quote, treat an
  offered activity as completed, or infer success from a bare yes when
  the prior message asked several different things. A current reply
  that explicitly confirms the described ability may support a claim.
- The current message can describe an emerging ability without saying
  it is fast or effortless. Preserve the reported limitation; do not
  discard a real capability merely because it is not easily yet.
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
  interpretationContext?: {
    recordingTargetChildId: string;
    previousAssistant: PreviousJournalAssistant | null;
  };
}

export function buildClaimExtractionPrompt(input: ClaimExtractionInput): string {
  const roster = input.children
    .map(
      (child) =>
        `  ${child.childId}  ${child.name}, ${Math.floor(child.ageMonths / 12)} years old ` +
        `(${child.ageMonths} months)`,
    )
    .join("\n");
  const context = input.interpretationContext;
  const targetExists = context && input.children.some((child) => child.childId === context.recordingTargetChildId);
  const encoded = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
  return [
    `<skill_catalog>\n${renderSkillCatalog(input.children.map((child) => child.ageMonths))}\n</skill_catalog>`,
    `<children>\n${roster}\n</children>`,
    ...(targetExists ? [`<interpretation_context>\n${encoded(context)}\n</interpretation_context>`] : []),
    `<message>\n${input.message.slice(0, 8_000)}\n</message>`,
  ].join("\n\n");
}

/** Shared exact request for the production extractor and isolated model evals. */
export function buildClaimExtractionRequest(input: ClaimExtractionInput) {
  return {
    ...homaModelSettings(),
    schema: extractedClaimsSchema,
    system: EXTRACTION_SYSTEM,
    // Catalog FIRST, deliberately. It is the largest and most stable
    // block. Exact roster-age eligibility keeps every valid option;
    // families with the same eligible catalog can share its prefix.
    // The per-family roster and current message follow it.
    prompt: buildClaimExtractionPrompt(input),
    maxOutputTokens: 4_000,
    maxRetries: 1,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(input.familyId, "progress_claim_extraction"),
      },
    },
  };
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

  const startedAt = Date.now();

  try {
    const result = await generateObject(buildClaimExtractionRequest(input));

    await recordModelUsage({
      familyId: input.familyId,
      surface: "progress_claim_extraction",
      channel: "web",
      model: HOMA_MODEL,
      modality: "text",
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      durationMs: Date.now() - startedAt,
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
