import { defineDynamic } from "eve/tools";
import { z } from "zod";

import {
  defineBoundedTool,
  TOOL_DEADLINE,
} from "../../lib/agent-tool-deadline";

const restrictedInputSchema = z.object({}).passthrough();

export const RESTRICTED_PROGRESS_FRAMEWORK_TOOLS = [
  "web_search",
  "ask_question",
  "todo",
  "read_file",
  "glob",
  "grep",
  "agent",
] as const;

type RestrictedProgressFrameworkTool =
  (typeof RESTRICTED_PROGRESS_FRAMEWORK_TOOLS)[number];

function denial(tool: RestrictedProgressFrameworkTool) {
  return {
    ok: false as const,
    reason: "restricted_progress_task" as const,
    tool,
  };
}

export function isRestrictedProgressTask(attributes: unknown): boolean {
  return (
    (attributes as { channel?: unknown } | undefined)?.channel ===
    "progress_next_move"
  );
}

export function resolveProgressTaskBoundaryTools(
  attributes: unknown,
) {
  if (!isRestrictedProgressTask(attributes)) return null;

  return {
    web_search: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. Use only the bounded task context.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("web_search");
      },
    }),
    ask_question: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. Persist a clarification or honest stop instead.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("ask_question");
      },
    }),
    todo: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. Complete the one bounded operation directly.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("todo");
      },
    }),
    read_file: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. The task message contains all permitted evidence.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("read_file");
      },
    }),
    glob: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. The task message contains all permitted evidence.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("glob");
      },
    }),
    grep: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. The task message contains all permitted evidence.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("grep");
      },
    }),
    agent: defineBoundedTool({
      description:
        "Unavailable in a restricted Progress next move task. Do not delegate the bounded family context.",
      inputSchema: restrictedInputSchema,
      deadlineMs: TOOL_DEADLINE.quick,
      repeatable: true,
      async execute() {
        return denial("agent");
      },
    }),
  };
}

export default defineDynamic({
  events: {
    "step.started": (_event, ctx) =>
      resolveProgressTaskBoundaryTools(
        ctx.session.auth.current?.attributes,
      ),
  },
});
