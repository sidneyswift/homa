/**
 * Machine-authored chat handoffs that must never render as a parent's words.
 * Parameters are advisory only. Every durable fact is re-derived server-side.
 */
export const DIRECTIVE_NAMESPACE = "homa:onboarding";

export type DirectiveName =
  | "kickoff"
  | "resume"
  | "checklist_complete"
  | "panel_opened"
  | "details_saved";

export interface HiddenDirective {
  name: string;
  params: Record<string, string>;
  raw: string;
}

const DIRECTIVE_PATTERN = new RegExp(
  `^\\[\\[${DIRECTIVE_NAMESPACE.replace(":", "\\:")}\\s+([a-z_]+)((?:\\s+[a-zA-Z0-9_]+=[^\\s\\]]*)*)\\s*\\]\\]$`,
);

export function isHiddenDirective(text: string): boolean {
  return DIRECTIVE_PATTERN.test(text.trim());
}

export function parseHiddenDirective(text: string): HiddenDirective | null {
  const raw = text.trim();
  const match = DIRECTIVE_PATTERN.exec(raw);
  if (!match) return null;
  const params: Record<string, string> = {};
  const tail = match[2] ?? "";
  for (const pair of tail.trim().split(/\s+/)) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    params[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return { name: match[1], params, raw };
}

export function formatHiddenDirective(
  name: DirectiveName,
  params: Record<string, string | number | null | undefined> = {},
): string {
  const parts = [DIRECTIVE_NAMESPACE, name];
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const safeKey = key.replace(/[^a-zA-Z0-9_]/g, "");
    const safeValue = String(value).replace(/[^a-zA-Z0-9_./:-]/g, "");
    if (safeKey.length === 0 || safeValue.length === 0) continue;
    parts.push(`${safeKey}=${safeValue}`);
  }
  return `[[${parts.join(" ")}]]`;
}

export function hasVisibleText(text: string): boolean {
  return text.trim().length > 0 && !isHiddenDirective(text);
}
