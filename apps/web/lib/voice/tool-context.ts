/**
 * Shared parsing for Telnyx voice tool URLs. Values arrive from Telnyx
 * dynamic-variable templates, not from the model, but a malformed template
 * should return a normal tool error instead of reaching UUID-typed SQL.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export type VoiceFamilyParam =
  | { ok: true; familyId: string }
  | { ok: false; error: string };

export function readVoiceFamilyId(url: URL, missingError: string): VoiceFamilyParam {
  const familyId = url.searchParams.get("family_id");
  if (!familyId) return { ok: false, error: missingError };
  if (!isUuid(familyId)) {
    return {
      ok: false,
      error:
        "This call is missing a valid Homa family link. Ask the parent to continue in chat.",
    };
  }
  return { ok: true, familyId };
}

export function readVoiceChildId(url: URL): string | null {
  const childId = url.searchParams.get("child_id");
  return isUuid(childId) ? childId : null;
}
