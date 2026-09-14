import { tool } from "ai";
import type { ToolContext } from "eve/tools";
import { z } from "zod";
import getChildren from "../../agent/tools/get_children";
import type { Owner, Turn } from "./store";

export function readToolContext(owner: Owner, turn: Turn, accessToken: string): ToolContext {
  const current = { authenticator: "supabase", principalId: owner.userId, principalType: "user", attributes: {
    familyId: owner.familyId, memberUserId: owner.userId, supabaseAccessToken: accessToken, channel: "web",
  } };
  const unavailable = () => { throw new Error("This runtime facility is outside the read-only preview"); };
  return { session: { id: turn.session_id, turn: { id: turn.id, sequence: 0 }, auth: { current, initiator: current } },
    getSandbox: unavailable, getSkill: unavailable, getToken: unavailable, requireAuth: unavailable };
}

export function foregroundTools(context: ToolContext, record: (event: Record<string, unknown>) => Promise<void>, signal: AbortSignal, failTool = false) {
  return { get_children: tool({
    description: getChildren.description,
    inputSchema: getChildren.inputSchema as z.ZodType<Record<string, never>>,
    async execute(input, options) {
      signal.throwIfAborted();
      await record({ type: "tool.execution.started", name: "get_children", callId: options.toolCallId, input });
      if (failTool) throw new Error("Injected read-tool failure for the isolated preview test");
      // Invoke the actual shared tool, including its existing deadline and auth checks.
      const result = await getChildren.execute(input, context);
      signal.throwIfAborted();
      await record({ type: "tool.execution.completed", name: "get_children", callId: options.toolCallId, output: result });
      return result;
    },
  }) };
}
