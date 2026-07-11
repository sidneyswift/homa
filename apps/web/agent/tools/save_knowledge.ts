import { defineTool } from "eve/tools";
import { z } from "zod";

import {
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
        "The stable topic slug, e.g. 'montessori', 'phonics', 'early-childhood-recent-studies'. Reuse the key you were given; never invent variants.",
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
      .describe("When this should be researched again. Studies ~14, subjects ~60, methods ~180."),
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
