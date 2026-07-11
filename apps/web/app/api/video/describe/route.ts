import { resolveApiFamily } from "../../../../lib/api-auth";
import { isFamilyArtifactUrl } from "../../../../lib/materials/artifact-store";
import { rateLimited } from "../../../../lib/map/ratelimit";
import {
  describeVideoAtUrl,
  twelveLabsConfigured,
} from "../../../../lib/video/twelvelabs";

/**
 * POST /api/video/describe: the video gateway (step 2 of 2). Takes the
 * blob URL of a video this family uploaded through /api/video/upload,
 * has Pegasus watch it, and returns text the client passes to the agent
 * as part of its message (agent.send), the same way dictation returns a
 * transcript for the draft. The route never touches the conversation.
 *
 * Tenancy: the session resolves the family, and the URL must point
 * inside that family's own blob space (isFamilyArtifactUrl), so nobody
 * can spend our video minutes describing other people's URLs, and the
 * gateway never fetches arbitrary internet content on a client's
 * say-so.
 *
 * Fail-soft contract, matching dictation: an unwatchable video returns
 * { description: null } with 200 so the client can offer a retry in
 * Homa's voice. Hard failures use honest status codes.
 */

/** Sync analysis holds the connection while the model watches. */
export const maxDuration = 300;

/** Each call spends real Twelve Labs minutes; a runaway client should
 *  hit a wall before the bill does. Per family, per instance. */
const DESCRIBE_RATE_LIMIT = 6;
const DESCRIBE_RATE_WINDOW_MS = 60_000;

/** A caller may sharpen the question ("what did she say about the
 *  fractions page?"), capped so the prompt stays a prompt. */
const PROMPT_MAX_CHARS = 500;

interface DescribeRequestBody {
  videoUrl?: string;
  prompt?: string;
}

export async function POST(request: Request): Promise<Response> {
  if (!twelveLabsConfigured()) {
    return Response.json({ description: null, reason: "not-configured" }, { status: 503 });
  }

  const auth = await resolveApiFamily(request);
  if (!auth) {
    return Response.json({ description: null }, { status: 401 });
  }

  if (rateLimited(`video-describe:${auth.familyId}`, DESCRIBE_RATE_LIMIT, DESCRIBE_RATE_WINDOW_MS)) {
    return Response.json({ description: null }, { status: 429 });
  }

  let body: DescribeRequestBody;
  try {
    body = (await request.json()) as DescribeRequestBody;
  } catch {
    return Response.json({ description: null }, { status: 400 });
  }

  const videoUrl = body.videoUrl;
  if (typeof videoUrl !== "string" || !isFamilyArtifactUrl(videoUrl, auth.familyId)) {
    return Response.json({ description: null }, { status: 400 });
  }
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim().length > 0
      ? body.prompt.trim().slice(0, PROMPT_MAX_CHARS)
      : undefined;

  const description = await describeVideoAtUrl(videoUrl, { prompt });
  return Response.json({ description });
}
