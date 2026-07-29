import { rateLimited } from "../../../../../lib/map/ratelimit";
import { createSupabaseServerClient } from "../../../../../lib/supabase/server";
import { runVoiceTool } from "../../../../../lib/voice/realtime-tools";

/**
 * POST /api/voice/realtime/tool: runs one allowlisted tool for a browser
 * voice conversation (issue #283).
 *
 * The realtime model emits a tool call over its own socket; the client
 * hands it here and returns the result to the model. That hop exists so
 * the tool never runs in the browser: the model is talking to a parent and
 * its arguments are model output, so the only place they can be trusted is
 * behind this route's own authentication.
 *
 * On the AI SDK's warning against generic "execute tool by name" routes.
 * The concern is a dispatcher that skips the checks a purpose-built
 * endpoint would apply. This one applies all of them: the caller's cookie
 * session is verified here, familyId is read from their own membership row
 * rather than the request, the name must be present in a fixed allowlist,
 * the arguments are parsed by the tool's own zod schema, and the tool then
 * runs under the caller's JWT with RLS enforcing tenancy a second time.
 * The alternative, one route per tool, would be six copies of exactly this
 * and six chances to forget one of the five checks.
 *
 * The model never supplies familyId. It cannot: the field is not read from
 * the body at all.
 */

/** Generous for a conversation, tight enough that a model stuck in a loop
 * cannot spend the family's afternoon. */
const MAX_TOOL_CALLS_PER_SESSION_PER_HOUR = 60;
const HOUR_MS = 60 * 60 * 1000;

interface ToolCallBody {
  name?: unknown;
  args?: unknown;
  /** The realtime session this call belongs to, for the tool context's
   * session id. Untrusted, so it is only ever used as a label. */
  sessionId?: unknown;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    return Response.json({ ok: false, reason: "no-session" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("family_members")
    .select("family_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership) {
    return Response.json({ ok: false, reason: "no-family" }, { status: 404 });
  }
  const familyId = membership.family_id as string;

  if (rateLimited(`realtime-tool:${user.id}`, MAX_TOOL_CALLS_PER_SESSION_PER_HOUR, HOUR_MS)) {
    return Response.json({ ok: false, reason: "rate-limited" }, { status: 429 });
  }

  let body: ToolCallBody;
  try {
    body = (await request.json()) as ToolCallBody;
  } catch {
    return Response.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const outcome = await runVoiceTool({
    name: body.name,
    args: body.args,
    identity: {
      familyId,
      memberUserId: user.id,
      supabaseAccessToken: accessToken,
      sessionId:
        typeof body.sessionId === "string" && body.sessionId.length > 0
          ? body.sessionId.slice(0, 64)
          : "voice",
    },
  });

  // Always 200 with a result the model can read aloud. A non-2xx here would
  // surface to a talking parent as a dropped sentence; the tool's own note
  // is the honest thing to say instead.
  return Response.json({ ok: outcome.ok, output: outcome.output });
}
