/**
 * The material studio test bench's brief (founder console /admin/studio,
 * direction lab 2026-07-18-material-studio-admin-directions.html). Pure
 * string assembly so the exact prompt a lab session receives is unit
 * tested and visible in one place; the channel route calls this, the
 * admin page shows the same text per run for the "see into the prompts"
 * half of the bench.
 *
 * Mirrors lib/jobs/session.ts buildStageBrief in shape: the session gets
 * its family context from the turn.started instructions (the channel is
 * in PINNED_AGENT_CHANNELS), so the brief carries only the test framing
 * and the request.
 */

/** Mirrors the materials_studio_runs.request check constraint. */
export const STUDIO_REQUEST_MIN_CHARS = 3;
export const STUDIO_REQUEST_MAX_CHARS = 600;

export const STUDIO_RUN_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One plain reason a request cannot run, or null when it can. */
export function studioRequestProblem(request: string): string | null {
  const trimmed = request.trim();
  if (trimmed.length < STUDIO_REQUEST_MIN_CHARS) {
    return "Type what the skill should make first.";
  }
  if (trimmed.length > STUDIO_REQUEST_MAX_CHARS) {
    return `Keep the request under ${STUDIO_REQUEST_MAX_CHARS} characters.`;
  }
  return null;
}

export interface StudioBriefInput {
  /** The founder's request, already validated by studioRequestProblem. */
  request: string;
  /** The target child's name from the family row, when one was picked. */
  childName: string | null;
}

/** The message that wakes the lab session. */
export function buildStudioBrief(input: StudioBriefInput): string {
  const target = input.childName
    ? `The material is for ${input.childName}; use that child's context and spelling.`
    : "No specific child was picked; choose the best-fitting child from your family context and say which you chose.";
  return [
    "You are running a materials-studio TEST for the founder's test bench,",
    "against a sandbox family. Treat the request below exactly as if the",
    "parent asked for it in chat.",
    "",
    `The request: "${input.request.trim()}"`,
    "",
    target,
    "",
    "Rules for this test run:",
    "- Load the materials-studio skill and follow its full procedure.",
    "- Set difficulty from the family context evidence. When evidence is",
    "  missing, do NOT ask a calibrating question (nobody will answer);",
    "  pick a reasonable level and state the assumption in your reply.",
    "- Build the material with create_printable in this turn. If the",
    "  quality check reports issues, revise once with revisesId, then stop.",
    "- Never call mark_material_final: finals are the parent's call, and",
    "  this is a test.",
    "- Do not message, text, or email anyone. The founder reads the",
    "  result in the console. End with two or three sentences on what you",
    "  built and why you chose that difficulty and creation path.",
  ].join("\n");
}
