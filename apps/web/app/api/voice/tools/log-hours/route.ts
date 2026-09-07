import { readVoiceFamilyId } from "../../../../../lib/voice/tool-context";
import { hasVoiceWebhookSecret } from "../../../../../lib/voice/webhook-auth";

/** The legacy provider webhook has no authenticated per-activity source identity.
 * Keep its authentication boundary and report the limitation without an unkeyed write. */
export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (!hasVoiceWebhookSecret(request, url)) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }
  const context = readVoiceFamilyId(url, "This call is not linked to a Homa family.");
  if (!context.ok) return Response.json({ success: false, error: context.error });
  return Response.json({ success: false, error: "I could not safely add time from this phone call. Nothing was recorded. Please send the activity and minutes in Homa chat." });
}
