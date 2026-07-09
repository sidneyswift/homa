import { after } from "next/server";

import { runSessionReview } from "../../../../lib/learning/session-review";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

/**
 * POST /api/learning/review: the post-turn review trigger (agentic
 * ladder item 8, M2-13). The chat client fires this after every finished
 * turn; the route decides whether enough NEW conversation has accumulated
 * to be worth a review pass, claims the window, and runs the extraction
 * in after() so the response returns immediately.
 *
 * Auth: the caller's own cookie session resolves their family under RLS;
 * the sessionId from the body is only ever used TOGETHER with that
 * familyId (a session id belonging to another family matches zero rows).
 * The model never chooses what gets reviewed; message accumulation does.
 */

interface ReviewRequestBody {
  sessionId?: string;
}

export async function POST(request: Request): Promise<Response> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return Response.json({ queued: false }, { status: 401 });
  }
  const { data: membership } = await supabase
    .from("family_members")
    .select("family_id")
    .limit(1)
    .maybeSingle();
  const familyId = membership?.family_id;
  if (!familyId) return Response.json({ queued: false });

  let body: ReviewRequestBody;
  try {
    body = (await request.json()) as ReviewRequestBody;
  } catch {
    return Response.json({ queued: false }, { status: 400 });
  }
  const sessionId = body.sessionId;
  if (typeof sessionId !== "string" || sessionId.length === 0 || sessionId.length > 120) {
    return Response.json({ queued: false }, { status: 400 });
  }

  after(async () => {
    try {
      await runSessionReview(familyId, sessionId);
    } catch (error) {
      console.error(
        "post-turn review failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
  });

  return Response.json({ queued: true });
}
