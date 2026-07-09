import { saveFamilyMemory } from "../../../../../lib/learning/save-memory";
import { emitMapEvent } from "../../../../../lib/map/events";
import { rateLimited } from "../../../../../lib/map/ratelimit";

/**
 * POST /api/voice/tools/remember: the voice assistants' live memory tool
 * (agentic ladder item 6). "Remember this" works ON the call now: the
 * model supplies only the fact itself; the family it lands in is
 * templated into the URL from that call's own dynamic variables, exactly
 * the send-email tool's posture, so the model can never choose whose
 * memory it writes.
 *
 * Every write goes through the ONE guarded server path
 * (lib/learning/save-memory.ts): injection scan, family budget, dedupe,
 * in-family child resolution. Responses are tool RESULTS the assistant
 * reads back: rejections say why in plain language so the model can
 * relay or self-correct, never silently pretend it saved.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_FAMILY_PER_DAY = 20;

interface ToolCallBody {
  content?: string;
  kind?: string;
  child_name?: string;
}

export async function POST(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const secret = process.env.TELNYX_WEBHOOK_SECRET;
  if (!secret || url.searchParams.get("key") !== secret) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  const familyId = url.searchParams.get("family_id");
  const childId = url.searchParams.get("child_id") || null;
  if (!familyId) {
    return Response.json({
      success: false,
      error:
        "This caller is not linked to a Homa family yet, so there is nowhere to save this. Offer to set it up at thankshoma.com.",
    });
  }

  let body: ToolCallBody;
  try {
    body = (await request.json()) as ToolCallBody;
  } catch {
    return Response.json({ success: false, error: "Missing the fact to remember." });
  }
  const content = body.content?.trim();
  if (!content) {
    return Response.json({ success: false, error: "Missing the fact to remember." });
  }
  if (rateLimited(`voice-remember:${familyId}`, MAX_PER_FAMILY_PER_DAY, DAY_MS)) {
    return Response.json({
      success: false,
      error: "Enough saved from calls today. Tell the parent you'll note the rest next time.",
    });
  }

  const kind = body.kind === "what_works" ? "what_works" : "fact";
  const result = await saveFamilyMemory({
    familyId,
    content,
    kind,
    source: "call",
    // The curriculum line templates a real child_id; the general line
    // sends blank and the model names the child instead. Both resolve
    // inside THIS family only.
    childId: childId,
    childName: body.child_name?.trim() || null,
  });

  if (!result.saved) {
    const errors: Record<string, string> = {
      "too-short": "That was too short to be worth saving. Say the fact in one full sentence.",
      "blocked-by-scan":
        "That reads like an instruction, not a fact about the family. Rephrase it as a plain fact and try again.",
      duplicate: "Already saved. Tell the parent you have it.",
      "budget-full":
        "Memory is full for this family. Tell the parent you'll keep it in mind for this call, and they can tidy saved memories at thankshoma.com.",
      "unknown-child":
        "That child name is not in this family. Use the child's name exactly as the family context shows it, or leave the child off for a family-wide fact.",
    };
    return Response.json({ success: false, error: errors[result.reason] });
  }

  await emitMapEvent("voice.memory_saved", {
    family_id: familyId,
    ...(result.childId ? { child_id: result.childId } : {}),
  });
  return Response.json({
    success: true,
    note: "Saved. Mention it to the parent in one short natural aside.",
  });
}
