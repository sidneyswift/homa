import { z } from "zod";

/**
 * Realtime has one tool: hand the spoken request to the ordinary Homa agent.
 * The agent then loads the right fleet skill and uses its full authenticated
 * tool surface. This keeps voice parity automatic as Homa gains capabilities.
 */

export const ASK_HOMA_TOOL_NAME = "ask_homa";

const askHomaInputSchema = z.object({
  request: z
    .string()
    .trim()
    .min(1)
    .max(8_000)
    .describe(
      "The parent's request in their own words. Preserve names, dates, amounts, constraints, and corrections exactly.",
    ),
});

export type AskHomaInput = z.infer<typeof askHomaInputSchema>;

export interface RealtimeToolDefinition {
  type: "function";
  name: typeof ASK_HOMA_TOOL_NAME;
  description: string;
  parameters: Record<string, unknown>;
}

export function realtimeToolDefinitions(): RealtimeToolDefinition[] {
  return [
    {
      type: "function",
      name: ASK_HOMA_TOOL_NAME,
      description:
        "Hand a request to the full Homa agent. Call this whenever the parent asks you to know family-specific facts, remember or change anything, make or find a printable, use the planner, calendar, tasks, hours, progress, binder, curriculum or research capabilities, send something, or perform any action. The full agent loads the right fleet skill and uses the same authenticated tools as mobile chat. Its spokenReply is the exact reply to read aloud, and its effects are rendered by the app.",
      parameters: z.toJSONSchema(askHomaInputSchema, { io: "input" }) as Record<
        string,
        unknown
      >,
    },
  ];
}

export function parseAskHomaInput(value: unknown): AskHomaInput | null {
  const parsed = askHomaInputSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : null;
}
