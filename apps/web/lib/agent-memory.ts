/**
 * Shared memory model for Homa's durable, per-family memory (M2-02 slice).
 * Rows live in public.family_memories behind RLS; tools write them and the
 * dynamic context loader (agent/instructions/family-context.ts) injects them
 * every turn. This module owns the invariants both sides share:
 *
 *   1. the character budget that forces consolidation instead of hoarding
 *      (the Hermes consolidate-on-full pattern, 11-hermes-implementation-notes),
 *   2. the write-time injection scan (M2-14 floor: memory content re-enters
 *      the system prompt every turn, so it must never carry instructions),
 *   3. one shape + formatter so context and tool results stay consistent.
 */

export const MEMORY_KINDS = ["fact", "what_works"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface MemoryRow {
  id: string;
  child_id: string | null;
  kind: string;
  content: string;
  source: string;
  created_at: string;
}

/** Total budget across a family's long-term rows (facts + what-works). When
 *  an add would cross it, the tool returns current entries and asks the
 *  model to consolidate in the same turn instead of silently dropping. */
export const FAMILY_MEMORY_CHAR_BUDGET = 4000;

/** Hard cap per entry; mirrors the DB check constraint (500). */
export const MEMORY_ENTRY_MAX_CHARS = 300;

// Invisible/bidi characters that hide payloads from human review.
const INVISIBLE_CHARS = /[\u200b\u200c\u200d\u200e\u200f\u2060\u2061\u2062\u2063\u2064\u2066\u2067\u2068\u2069\ufeff]/;

// High-signal injection patterns (subset of the Hermes strict set). Memory
// content is re-read as system context forever, so refuse anything shaped
// like an instruction to the model rather than a fact about the family.
const THREAT_PATTERNS: Array<[RegExp, string]> = [
  [/ignore\s+(?:\w+\s+)*(previous|all|above|prior)\s+(?:\w+\s+)*instructions/i, "prompt_injection"],
  [/system\s+prompt/i, "sys_prompt_reference"],
  [/disregard\s+(?:\w+\s+)*(your|all|any)\s+(?:\w+\s+)*(instructions|rules|guidelines)/i, "disregard_rules"],
  [/do\s+not\s+(?:\w+\s+)*tell\s+(?:\w+\s+)*the\s+(user|parent|mom)/i, "deception_hide"],
  [/(send|post|upload|transmit)\s+.*\s+(to|at)\s+https?:\/\//i, "send_to_url"],
  [/<[^>]*script/i, "html_script"],
  [/(?:api[_-]?key|token|secret|password)\s*[=:]\s*\S{8,}/i, "hardcoded_secret"],
];

/**
 * scanMemoryContent(content): string | null
 * Returns a block reason when content must not be stored, else null.
 */
export function scanMemoryContent(content: string): string | null {
  if (INVISIBLE_CHARS.test(content)) {
    return "Blocked: content contains invisible unicode characters (possible injection).";
  }
  for (const [pattern, id] of THREAT_PATTERNS) {
    if (pattern.test(content)) {
      return `Blocked: content matches threat pattern '${id}'. Memories are facts about the family, never instructions.`;
    }
  }
  return null;
}

/** Sum of stored characters that count against the family budget. */
export function memoryUsageChars(rows: Pick<MemoryRow, "content">[]): number {
  return rows.reduce((total, row) => total + row.content.length, 0);
}

/**
 * formatMemoriesForContext(rows, childNamesById): string
 * Renders saved memories as compact labeled lines for the per-turn context
 * block. Newlines inside content are flattened so one row is one line.
 */
export function formatMemoriesForContext(
  rows: MemoryRow[],
  childNamesById: Map<string, string>,
): string {
  if (rows.length === 0) return "(nothing saved yet)";
  return rows
    .map((row) => {
      const child = row.child_id ? childNamesById.get(row.child_id) : null;
      const label = row.kind === "what_works" ? "what works" : "fact";
      const scope = child ? `${label} · ${child}` : label;
      return `- [${scope}] ${row.content.replace(/\s*\n\s*/g, " ")}`;
    })
    .join("\n");
}
