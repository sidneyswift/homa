/**
 * Resolves the general phone line's Telnyx ids at call time instead of
 * carrying them as environment variables.
 *
 * The curriculum line keeps its assistant and TeXML app in env
 * (TELNYX_CURRICULUM_ASSISTANT_ID, TELNYX_CURRICULUM_TEXML_APP_ID), which
 * works but adds two values a human has to set correctly after
 * provisioning, and which silently rot if the assistant is ever recreated.
 * The general line already identifies itself the way the provisioning
 * script does, by name, so look it up. That is the lesson of #276 applied
 * to configuration: a step someone has to remember is a step that gets
 * missed.
 *
 * Cached for the life of the lambda because these ids change only when the
 * assistant is recreated, which is a provisioning event, not a runtime one.
 * A failed lookup is not cached, so a transient Telnyx error does not pin a
 * null for the instance's lifetime.
 */

/** Mirrors VOICE_ASSISTANT_NAME in scripts/telnyx-shared.mts. Both sides
 * find this assistant by name, so the two strings must agree; the
 * provisioning script is the one that creates it. */
export const VOICE_ASSISTANT_NAME = "Homa voice (experiment)";

interface AssistantRow {
  id: string;
  name: string;
  telephony_settings?: { default_texml_app_id?: string | null };
}

export interface GeneralLineIds {
  assistantId: string;
  texmlAppId: string;
}

let cached: GeneralLineIds | null = null;

/** Test seam, and the way a lambda drops a stale id after a reprovision. */
export function resetGeneralLineCache(): void {
  cached = null;
}

async function telnyxJson(path: string, apiKey: string): Promise<unknown> {
  const response = await fetch(`https://api.telnyx.com/v2${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    throw new Error(`Telnyx ${response.status} on ${path}`);
  }
  return (await response.json()) as unknown;
}

function rowsOf(payload: unknown): AssistantRow[] {
  if (Array.isArray(payload)) return payload as AssistantRow[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const data = (payload as { data: unknown }).data;
    if (Array.isArray(data)) return data as AssistantRow[];
    if (data && typeof data === "object") return [data as AssistantRow];
  }
  return [];
}

/**
 * The general assistant's id and the TeXML app an outbound call is placed
 * through, or null when the line is not provisioned yet. Never throws: a
 * caller that cannot resolve these should decline to dial and say so, not
 * fail the request in a way that looks like a bug to the parent.
 */
export async function generalLineIds(
  apiKey: string,
): Promise<GeneralLineIds | null> {
  if (cached) return cached;
  try {
    const assistants = rowsOf(await telnyxJson("/ai/assistants", apiKey));
    const assistant = assistants.find((row) => row.name === VOICE_ASSISTANT_NAME);
    if (!assistant) return null;

    // The list endpoint has returned assistants without telephony_settings
    // before, so re-read the one we want rather than trusting the summary.
    const texmlAppId =
      assistant.telephony_settings?.default_texml_app_id ??
      rowsOf(await telnyxJson(`/ai/assistants/${assistant.id}`, apiKey))[0]
        ?.telephony_settings?.default_texml_app_id ??
      null;
    if (!texmlAppId) return null;

    cached = { assistantId: assistant.id, texmlAppId };
    return cached;
  } catch (error) {
    console.error(
      "general line: Telnyx id lookup failed:",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}
