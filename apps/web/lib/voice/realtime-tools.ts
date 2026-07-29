import { z } from "zod";

import exploreChildMap from "../../agent/tools/explore_child_map";
import getChildren from "../../agent/tools/get_children";
import listFamilyEvents from "../../agent/tools/list_family_events";
import logHours from "../../agent/tools/log_hours";
import recall from "../../agent/tools/recall";
import remember from "../../agent/tools/remember";

/**
 * The tools a browser voice session may call (issue #283).
 *
 * There is ONE tool registry in this product, `agent/tools/`, and this is a
 * second front door onto it, not a second copy. Every entry below is the
 * same module eve loads for web chat, with the same zod schema, the same
 * `defineBoundedTool` deadline, and the same body. A voice-only
 * reimplementation is how the phone line ended up with four tools and its
 * own honesty file, and it is the mistake this file exists to avoid.
 *
 * Why these six. A voice conversation is for talking, so the surface is
 * reads plus the two writes the phone line has already carried safely for
 * weeks. Nothing here can make a material, spend money, or message anyone,
 * which keeps the whole class of "Homa said she sent it" impossible rather
 * than merely discouraged. Widening this list is a deliberate act: add the
 * tool here AND name it in the boundary in realtime-session.ts, because a
 * capability the instructions do not mention is one Homa will describe
 * wrongly.
 *
 * Tenancy. Unlike the phone, an in-app voice session belongs to a signed-in
 * browser, so the tool route holds the caller's own JWT and these run in
 * `caller` mode under that adult's RLS, exactly as web chat does. familyId
 * is never taken from the model or the request body; it is read from the
 * session server-side. That is stronger than the pinned server path the
 * phone has to use, so voice needs no new entry in PINNED_CHANNELS.
 */

interface VoiceToolModule {
  description: string;
  inputSchema: z.ZodType;
  execute(input: unknown, ctx: unknown): Promise<unknown> | unknown;
}

/** The allowlist. A name absent here cannot be called, whatever the model
 * asks for, because dispatch is a lookup in this record and nothing else. */
export const VOICE_TOOLS: Record<string, VoiceToolModule> = {
  get_children: getChildren as unknown as VoiceToolModule,
  explore_child_map: exploreChildMap as unknown as VoiceToolModule,
  recall: recall as unknown as VoiceToolModule,
  list_family_events: listFamilyEvents as unknown as VoiceToolModule,
  remember: remember as unknown as VoiceToolModule,
  log_hours: logHours as unknown as VoiceToolModule,
};

export type VoiceToolName = keyof typeof VOICE_TOOLS;

/**
 * One spoken line per tool, for the capability boundary Homa reads.
 *
 * Separate from each tool's own `description`, which is written for a text
 * model choosing between sixty-two of them and is far too long to belong in
 * a spoken boundary. These are what a parent would recognize as a thing
 * Homa can do.
 *
 * Every allowlisted tool must have a line here, asserted in
 * realtime-session.test.ts. That assertion is the whole mechanism: the
 * phone line's boundary opened with "you have exactly four tools" as
 * hand-written prose, and the moment the tool set changed that sentence
 * became a lie in the one file whose job was preventing lies.
 */
export const VOICE_TOOL_BOUNDARY_LINES: Record<VoiceToolName, string> = {
  get_children: "check who is in her family and how old they are",
  explore_child_map: "look at where a child is with a subject",
  recall: "look back at what you two have talked about before",
  list_family_events: "read what is already on her calendar",
  remember: "remember something she tells you, for good",
  log_hours: "write down learning time she reports",
};

export function isVoiceToolName(name: unknown): name is VoiceToolName {
  return typeof name === "string" && Object.hasOwn(VOICE_TOOLS, name);
}

export interface RealtimeToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * The allowlist as realtime tool definitions, derived from the SAME zod
 * schemas eve validates against. Deriving rather than hand-writing is the
 * point: a hand-kept JSON copy drifts from the schema silently, and the
 * first symptom is a model sending an argument the tool rejects.
 */
export function realtimeToolDefinitions(): RealtimeToolDefinition[] {
  return Object.entries(VOICE_TOOLS).map(([name, tool]) => ({
    type: "function",
    name,
    description: tool.description,
    parameters: z.toJSONSchema(tool.inputSchema, { io: "input" }) as Record<
      string,
      unknown
    >,
  }));
}

export interface VoiceToolCallerIdentity {
  familyId: string;
  memberUserId: string;
  /** The caller's own Supabase JWT, so tools run under their RLS. */
  supabaseAccessToken: string;
  sessionId: string;
}

/**
 * The context an eve tool expects, synthesized for a session eve is not
 * running.
 *
 * This is safe because of something measured rather than assumed: across
 * all of `agent/tools/`, `ctx` is touched in exactly five ways, which are
 * the five below. The four tools that reach for `ctx.channel` beyond its
 * presence are the card-rendering ones, and none of them is on the voice
 * allowlist.
 *
 * `channel: "web"` is deliberate and load-bearing. It is literally true (a
 * signed-in browser), it keeps these tools on the caller-JWT path, and it
 * avoids inventing a channel string that ~15 per-tool guards have never
 * heard of, where a denylist would silently admit and an allowlist would
 * silently refuse.
 */
export function buildVoiceToolContext(identity: VoiceToolCallerIdentity): unknown {
  return {
    session: {
      id: identity.sessionId,
      turn: { id: `${identity.sessionId}:voice` },
      auth: {
        current: {
          attributes: {
            channel: "web",
            familyId: identity.familyId,
            memberUserId: identity.memberUserId,
            supabaseAccessToken: identity.supabaseAccessToken,
          },
        },
      },
    },
    channel: { kind: "channel:eve", metadata: { adapterName: "eve" } },
  };
}

export interface VoiceToolOutcome {
  ok: boolean;
  /** What the model reads back. Always a value, never a thrown error: a
   * voice turn that dies mid-sentence is worse than one that says it could
   * not do the thing. */
  output: unknown;
}

/**
 * Runs one allowlisted tool. Validation is the tool's own zod schema, so a
 * malformed argument is refused here rather than inside a half-run write.
 */
export async function runVoiceTool(input: {
  name: unknown;
  args: unknown;
  identity: VoiceToolCallerIdentity;
}): Promise<VoiceToolOutcome> {
  if (!isVoiceToolName(input.name)) {
    return {
      ok: false,
      output: { note: "That is not something I can do while we are talking." },
    };
  }
  const tool = VOICE_TOOLS[input.name];
  const parsed = tool.inputSchema.safeParse(input.args ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      output: { note: "I did not catch the details for that. Ask me again?" },
    };
  }
  try {
    const output = await tool.execute(
      parsed.data,
      buildVoiceToolContext(input.identity),
    );
    return { ok: true, output };
  } catch (error) {
    console.error(
      `voice tool ${input.name} failed:`,
      error instanceof Error ? error.message : "unknown",
    );
    return {
      ok: false,
      output: { note: "That did not go through just now." },
    };
  }
}
