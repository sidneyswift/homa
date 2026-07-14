import { RESEARCH_STAGES } from "@homa/core";
import { defineTool } from "eve/tools";
import { z } from "zod";

import {
  KNOWLEDGE_LENSES,
  KNOWLEDGE_TOPIC_TYPES,
  mergeKnowledgeRow,
} from "../../lib/knowledge/gate";
import { appendTaskRunArtifacts } from "../../lib/tasks/store";

/**
 * The shared knowledge bank's write tool (HT-3): available ONLY to
 * sessions Homa starts herself (fleet research, and the morning brief's
 * bounded top-up). Chat surfaces never see it succeed: general education
 * knowledge enters the fleet through researched, cited, gated rows, not
 * through whatever a conversation happened to mention. Every write runs
 * the automated gate (citation-resolve, sanitize, caps; D-ht-5); rows
 * that fail land flagged for audit and never reach families.
 */
export default defineTool({
  description:
    "Save one researched finding to Homa's shared knowledge bank (general education knowledge only, never anything about a specific family or child). Only research sessions and morning-brief top-ups may use this. Every claim needs a real, resolving citation URL.",
  inputSchema: z.object({
    topicType: z.enum(KNOWLEDGE_TOPIC_TYPES),
    topicKey: z
      .string()
      .regex(/^[a-z0-9_-]{2,60}$/)
      .describe(
        "The stable topic slug you were given for this cell, e.g. a taxonomy domain like 'multiplication-division', a style like 'montessori', or 'early-childhood-recent-studies'. Reuse the key exactly; never invent variants.",
      ),
    lens: z
      .enum(KNOWLEDGE_LENSES)
      .optional()
      .describe(
        "The research purpose of this cell, from your assignment: develops_when, how_to_teach, current_study, method, curriculum, or red_flags.",
      ),
    stage: z
      .enum(RESEARCH_STAGES)
      .optional()
      .describe(
        "The developmental band this row serves, from your assignment: early_years, early_elem, upper_elem, middle, or high. Omit only for stage-agnostic philosophy.",
      ),
    title: z.string().min(4).max(120),
    summary: z
      .string()
      .min(20)
      .max(500)
      .describe("2 to 4 plain sentences: the finding itself, standalone."),
    content: z
      .string()
      .min(40)
      .max(8000)
      .describe(
        "The full delta-knowledge as markdown: what changed or what the field knows, FACT/INFERENCE/CAUTION labeled, with the so-what for homeschooling parents. Never include any family's or child's data.",
      ),
    citations: z
      .array(
        z.object({
          url: z.string().url().max(500),
          accessedAt: z.string().max(20).optional().describe("YYYY-MM-DD"),
          claim: z.string().min(4).max(200).describe("The claim this URL backs."),
        }),
      )
      .min(1)
      .max(8),
    confidence: z.enum(["high", "medium", "low"]),
    sourceTier: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .describe("1 = primary/peer-reviewed .. 4 = directional only."),
    freshnessTtlDays: z
      .number()
      .int()
      .min(1)
      .max(3650)
      .optional()
      .describe(
        "Optional. Homa sets the default from the lens (current_study ~14, how_to_teach ~90, curriculum ~120, method ~180, develops_when ~365). You may only SHORTEN it; a longer value is clamped to the lens ceiling.",
      ),
  }),
  async execute(input, ctx) {
    const attributes = (ctx.session.auth.current?.attributes ?? {}) as {
      channel?: string;
      taskRunId?: string;
    };
    if (attributes.channel !== "research" && attributes.channel !== "dispatch") {
      return {
        saved: false,
        note: "The shared knowledge bank only accepts writes from Homa's own research runs, never from conversations. If this finding matters for THIS family, use remember instead.",
      };
    }

    const result = await mergeKnowledgeRow(input, {
      contributedBy: "agent_research",
      runId: attributes.taskRunId ?? null,
    });

    if (result.merged && result.rowId && attributes.taskRunId) {
      await appendTaskRunArtifacts(attributes.taskRunId, [
        { kind: "knowledge", id: result.rowId, title: input.title },
      ]);
    }

    return { saved: result.merged, note: result.note };
  },
});
