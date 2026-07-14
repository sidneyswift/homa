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

export const MODALITIES = ["visual", "auditory", "kinesthetic", "reading_writing"] as const;
export type Modality = (typeof MODALITIES)[number];

export const MEMORY_KINDS = ["fact", "what_works"] as const;
export type MemoryKind = (typeof MEMORY_KINDS)[number];

export interface MemoryRow {
  id: string;
  child_id: string | null;
  kind: string;
  content: string;
  source: string;
  created_at: string;
  modality: string | null;
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
 * Contradiction guardrail for saves. When a new fact lands semantically
 * close to an active memory, the save still succeeds but the tool result
 * names the older entry so the model can retire it with forget in the
 * same turn. Cause: "Story can already count to 3 easily" and "Story can
 * count to about 50" both rendered into every prompt (2026-07-10).
 *
 * Threshold calibrated on that real pair: the two counting facts sit at
 * cosine distance 0.42 while unrelated same-family pairs measured 0.58
 * and up, so 0.5 splits them with margin on both sides. A false flag
 * costs one harmless sentence in a tool note; a miss is just the old
 * status quo.
 */
export const MEMORY_CONFLICT_MAX_DISTANCE = 0.5;
const MEMORY_CONFLICT_MAX_RESULTS = 2;

export interface MemoryConflictCandidate {
  content: string;
  child_id: string | null;
  /** pgvector literal ("[0.1,...]") as both drivers return it, or null
   * when the row was saved without an embedding. */
  embedding: string | null;
}

function parseVectorLiteral(literal: string): number[] | null {
  const inner = literal.trim().replace(/^\[/, "").replace(/\]$/, "");
  if (inner.length === 0) return null;
  const values = inner.split(",").map(Number);
  return values.some((value) => !Number.isFinite(value)) ? null : values;
}

function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 1;
  return 1 - dot / denominator;
}

/**
 * findConflictingMemories(newEmbedding, newChildId, candidates): string[]
 * Returns the contents of active memories the new fact likely contradicts,
 * closest first. Scope rule (multi-kid law): a child-scoped fact is only
 * compared against that same child's rows and family-wide rows, so one
 * sibling's counting fact can never flag another's. Best-effort by
 * design: no embedding on either side means no comparison.
 */
export function findConflictingMemories(
  newEmbedding: string | null,
  newChildId: string | null,
  candidates: MemoryConflictCandidate[],
): string[] {
  if (!newEmbedding) return [];
  const target = parseVectorLiteral(newEmbedding);
  if (!target) return [];

  const scored: Array<{ content: string; distance: number }> = [];
  for (const candidate of candidates) {
    const sameScope =
      candidate.child_id === null ||
      (newChildId !== null && candidate.child_id === newChildId);
    if (!sameScope || !candidate.embedding) continue;
    const vector = parseVectorLiteral(candidate.embedding);
    if (!vector || vector.length !== target.length) continue;
    const distance = cosineDistance(target, vector);
    if (distance < MEMORY_CONFLICT_MAX_DISTANCE) {
      scored.push({ content: candidate.content, distance });
    }
  }
  return scored
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MEMORY_CONFLICT_MAX_RESULTS)
    .map((entry) => entry.content);
}

/** The sentence a save result carries when conflicts were found; empty
 * string when there is nothing to say. */
export function memoryConflictNote(conflicts: string[]): string {
  if (conflicts.length === 0) return "";
  const listed = conflicts.map((content) => `"${content}"`).join("; ");
  return ` This may contradict an older memory: ${listed}. If the new fact replaces it, call forget with a distinctive phrase from the old one in this same turn; if both are genuinely true, leave both.`;
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
