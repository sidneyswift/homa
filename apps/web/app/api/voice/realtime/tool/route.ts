import { rateLimited } from "../../../../../lib/map/ratelimit";
import { resolveApiFamily } from "../../../../../lib/api-auth";
import { persistCanonicalMessage } from "../../../../../lib/conversation-continuity/ledger";
import {
  askHomaFromVoice,
  parseVoiceHomaSessionState,
} from "../../../../../lib/voice/homa-bridge";
import {
  ASK_HOMA_TOOL_NAME,
  parseAskHomaInput,
} from "../../../../../lib/voice/realtime-tools";
import { resolveActiveObject } from "../../../../../lib/voice/active-object";
import { canonicalVoiceSessionId, validVoiceSequence, validVoiceSessionId } from "../../../../../lib/voice/source-turn";

/**
 * POST /api/voice/realtime/tool: hands one spoken request to the full Homa
 * agent, then returns her exact reply and authored tool effects.
 *
 * The realtime model emits a tool call over its own socket; the client
 * hands it here and returns the result to the model. That hop exists so
 * the tool never runs in the browser: the model is talking to a parent and
 * its arguments are model output, so the only place they can be trusted is
 * behind this route's own authentication.
 *
 * The realtime model receives one fixed function, never a generic tool
 * dispatcher. The ordinary Eve channel verifies the same caller JWT again,
 * resolves the family under caller RLS, loads fleet skills, and re-scopes
 * every model-supplied record id inside the authenticated family.
 *
 * The model never supplies familyId. It cannot: the field is not read from
 * the body at all.
 */

export const maxDuration = 300;

/** Generous for a conversation, tight enough that a model stuck in a loop
 * cannot spend the family's afternoon. */
const MAX_TOOL_CALLS_PER_SESSION_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

interface ToolCallBody {
  name?: unknown;
  args?: unknown;
  sessionId?: unknown;
  /** The native transcript is preferred over the model-reconstructed tool
   * argument. Older app builds omit it and safely fall back to args.request. */
  sourceText?: unknown;
  sourceSequence?: unknown;
  homaSessionState?: unknown;
  /** A visible-object pointer only. The server derives familyId from auth,
   * then re-resolves this id inside that family before Eve sees it. */
  activeObject?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const accessToken = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]
    ?? (await auth.supabase.auth.getSession()).data.session?.access_token;
  if (!accessToken) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }
  const { familyId, userId } = auth;

  if (rateLimited(`realtime-tool:${userId}`, MAX_TOOL_CALLS_PER_SESSION_PER_HOUR, HOUR_MS)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: ToolCallBody;
  try {
    body = (await request.json()) as ToolCallBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (body.name !== ASK_HOMA_TOOL_NAME) {
    return Response.json({
      ok: false,
      output: {
        ok: false,
        spokenReply: "That did not go through just now. Nothing changed.",
        effects: [],
      },
    });
  }
  const parsed = parseAskHomaInput(body.args);
  if (!parsed) {
    return Response.json({
      ok: false,
      output: {
        ok: false,
        spokenReply: "I missed that. Would you say it once more?",
        effects: [],
      },
    });
  }
  const sourceText =
    typeof body.sourceText === "string" && body.sourceText.trim().length > 0
      ? body.sourceText.trim()
      : parsed.request;
  if (!validVoiceSessionId(body.sessionId) || !validVoiceSequence(body.sourceSequence) || sourceText.length > 8_000) {
    return Response.json({
      ok: false,
      output: {
        ok: false,
        spokenReply: "I missed that. Would you say it once more?",
        effects: [],
      },
    });
  }
  const sessionId = canonicalVoiceSessionId(familyId, userId, body.sessionId);
  const sourceSequence = body.sourceSequence;
  let activeObjectContext: string | undefined;
  if (body.activeObject !== undefined && body.activeObject !== null) {
    const activeObject = await resolveActiveObject(familyId, body.activeObject);
    if (!activeObject.ok) {
      return Response.json({
        ok: false,
        output: {
          ok: false,
          spokenReply:
            "I cannot see that one safely anymore. Select it again, then ask me about it.",
          effects: [],
        },
      });
    }
    activeObjectContext = activeObject.contextMarkdown;
  }
  let sourceMessageId: string;
  try {
    const persisted = await persistCanonicalMessage({
      attributes: { familyId, memberUserId: userId },
      sessionId,
      channel: "web",
      sequence: sourceSequence,
      role: "user",
      content: sourceText,
      turnId: `${sessionId}:${sourceSequence}`,
      modality: "voice",
    });
    if (!persisted) throw new Error("voice source turn was not saved");
    sourceMessageId = persisted.id;
  } catch (error) {
    console.error(
      "voice bridge source persist failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return Response.json({
      ok: false,
      output: {
        ok: false,
        spokenReply: "I could not safely finish that just now. Nothing changed.",
        effects: [],
      },
    });
  }
  const outcome = await askHomaFromVoice({
    host: new URL(request.url).origin,
    accessToken,
    message: sourceText,
    sourceMessageId,
    activeObjectContext,
    sessionState: parseVoiceHomaSessionState(body.homaSessionState),
  });

  // Always 200 with a result the model can read aloud. A non-2xx here would
  // surface to a talking parent as a dropped sentence; the tool's own note
  // is the honest thing to say instead.
  return Response.json({ ok: outcome.ok, output: outcome });
}
