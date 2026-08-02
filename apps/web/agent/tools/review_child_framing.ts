import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";
import {
  OUTBOUND_CHILD_FRAMING_FALLBACK,
  OUTBOUND_CHILD_FRAMING_REASONS,
  validateOutboundChildFramingProposal,
} from "../../lib/outbound-child-framing";
import { approveOutboundChildFraming } from "../outbound-child-framing-state";

const inputSchema = z
  .object({
    intendedText: z
      .string()
      .min(1)
      .max(20_000)
      .describe("The complete reply Homa plans to send, copied exactly."),
    verdict: z
      .enum(["safe", "repair"])
      .describe(
        "Use safe only for an ordinary non-deficit meaning. Use repair for any child label, denial, echo, comparison, diagnosis, or verdict.",
      ),
    reason: z
      .enum(OUTBOUND_CHILD_FRAMING_REASONS)
      .describe("The meaning of the candidate phrase in this complete reply."),
    evidenceQuote: z
      .string()
      .min(1)
      .max(500)
      .describe(
        "An exact verbatim quote from intendedText that contains the candidate vocabulary.",
      ),
    repairedText: z
      .string()
      .min(1)
      .max(20_000)
      .nullable()
      .describe(
        "Null for safe text. For repair, the complete replacement reply without report-gate vocabulary, sibling comparison, diagnosis, or a verdict on a child.",
      ),
  })
  .strict();

export default defineBoundedTool({
  description:
    "Review a complete planned reply before sending when it uses report-gate vocabulary: behind, delay or delayed, disorder, diagnose or related forms, screening, assessment, or percentile. You judge the phrase's meaning. Ordinary senses such as research behind an idea or an object behind another object are safe. Any use about a child's status, including denying or echoing the label, comparing siblings, diagnosis, or a verdict, requires a full repair. Code verifies your exact quote and final wording. After this tool returns, send its text exactly and add nothing.",
  deadlineMs: TOOL_DEADLINE.quick,
  repeatable: true,
  inputSchema,
  async execute(input, ctx) {
    const validation = validateOutboundChildFramingProposal(input);
    const channel = ctx.session.auth.current?.attributes?.channel;
    const fallback = channel === "dispatch"
      ? OUTBOUND_CHILD_FRAMING_FALLBACK.dispatch
      : channel === "email"
        ? OUTBOUND_CHILD_FRAMING_FALLBACK.email
        : OUTBOUND_CHILD_FRAMING_FALLBACK.sms;

    if (!validation.accepted) {
      return {
        accepted: false,
        text: fallback,
        note: "The proposal did not pass exact verification. Send text exactly and add nothing.",
      };
    }

    approveOutboundChildFraming(validation.text);
    return {
      accepted: true,
      outcome: validation.outcome,
      text: validation.text,
      note: "Verified. Send text exactly and add nothing.",
    };
  },
});
