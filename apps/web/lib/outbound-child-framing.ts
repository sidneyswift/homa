import {
  BANNED_WORDS,
  findOutboundChildFramingCandidate,
} from "@homa/core";
import { z } from "zod";

import { enforceCopyLaws } from "./copy-laws-runtime";

export {
  findOutboundChildFramingCandidate,
  OUTBOUND_CHILD_FRAMING_FALLBACK,
  protectOutboundChildFraming,
  type OutboundChildFramingChannel,
  type OutboundChildFramingResult,
} from "@homa/core";

export const OUTBOUND_CHILD_FRAMING_REASONS = [
  "non_deficit_sense",
  "child_deficit_assertion",
  "child_deficit_denial",
  "child_deficit_echo",
  "other_deficit_framing",
] as const;

export const outboundChildFramingProposalSchema = z
  .object({
    intendedText: z.string().min(1).max(20_000),
    verdict: z.enum(["safe", "repair"]),
    reason: z.enum(OUTBOUND_CHILD_FRAMING_REASONS),
    evidenceQuote: z.string().min(1).max(500),
    repairedText: z.string().min(1).max(20_000).nullable(),
  })
  .strict();

export type OutboundChildFramingProposal = z.infer<
  typeof outboundChildFramingProposalSchema
>;

export type OutboundChildFramingValidation =
  | {
      accepted: true;
      text: string;
      outcome: "judged_safe" | "repaired";
      candidate: string;
    }
  | {
      accepted: false;
      failure:
        | "no_candidate"
        | "evidence_not_verbatim"
        | "evidence_missing_candidate"
        | "inconsistent_proposal"
        | "invalid_repair";
      candidate: string | null;
    };

/**
 * Verifies a model-proposed classification and repair. Meaning stays with the
 * model; this function owns exact source provenance and final-text policy.
 */
export function validateOutboundChildFramingProposal(
  proposal: OutboundChildFramingProposal,
): OutboundChildFramingValidation {
  const candidate = findOutboundChildFramingCandidate(proposal.intendedText);
  if (!candidate) {
    return { accepted: false, failure: "no_candidate", candidate: null };
  }
  if (!proposal.intendedText.includes(proposal.evidenceQuote)) {
    return { accepted: false, failure: "evidence_not_verbatim", candidate };
  }
  if (!BANNED_WORDS.test(proposal.evidenceQuote)) {
    return { accepted: false, failure: "evidence_missing_candidate", candidate };
  }

  if (proposal.verdict === "safe") {
    if (
      proposal.reason !== "non_deficit_sense"
      || proposal.repairedText !== null
    ) {
      return { accepted: false, failure: "inconsistent_proposal", candidate };
    }
    return {
      accepted: true,
      text: proposal.intendedText,
      outcome: "judged_safe",
      candidate,
    };
  }

  if (
    proposal.reason === "non_deficit_sense"
    || proposal.repairedText === null
  ) {
    return { accepted: false, failure: "inconsistent_proposal", candidate };
  }
  const repairedText = enforceCopyLaws(proposal.repairedText.trim());
  if (
    repairedText.length === 0
    || repairedText === proposal.intendedText
    || BANNED_WORDS.test(repairedText)
  ) {
    return { accepted: false, failure: "invalid_repair", candidate };
  }
  return { accepted: true, text: repairedText, outcome: "repaired", candidate };
}
