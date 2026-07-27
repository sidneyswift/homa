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

/**
 * Budget for the memories PINNED into the prompt each turn.
 *
 * This bounds prompt cost, not storage. Every character here is re-injected
 * on every turn of every channel, which is the whole reason a limit exists.
 * Storage is unbounded (founder ruling 2026-07-20, memory-render-time-budget):
 * a write is never refused for space, because a fact a parent told Homa and
 * Homa dropped is worse than a fact she has to search for. Anything past the
 * budget stays in family_memories, findable through recall and visible in the
 * founder Brain view. selectPinnedMemories below decides what makes the cut.
 *
 * Cause: the old write-time gate meant a full family lost facts outright on
 * the two paths that cannot consolidate, voice and the background extraction
 * loops. See build-log 2026-07-20.
 */
export const FAMILY_MEMORY_CHAR_BUDGET = 4000;

/** Compaction wakes when a family's active memories cross this share of the
 *  pinned budget, so merging happens off the critical path and well before
 *  anything would be pushed out of the prompt. */
export const MEMORY_COMPACTION_TRIGGER_RATIO = 0.8;

/** Hard cap per entry. The DB check constraint (1 to 500) is the backstop;
 *  this tighter cap is what the write paths actually enforce. */
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

/** Sum of stored characters across the given rows. Against
 *  FAMILY_MEMORY_CHAR_BUDGET this reads as "would all of it fit in the
 *  prompt", which is what the compaction trigger and the Brain view ask. */
export function memoryUsageChars(rows: Pick<MemoryRow, "content">[]): number {
  return rows.reduce((total, row) => total + row.content.length, 0);
}

/** Postgres hands back "2026-07-19 12:34:56.789+00", which Date.parse reads
 *  but string comparison would not order safely across formats. */
function memoryCreatedAtMs(row: MemoryRow): number {
  const parsed = Date.parse(row.created_at);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface PinnedMemorySelection {
  /** Rendered into this turn's context block, oldest first so the story of
   *  a child reads in order. */
  pinned: MemoryRow[];
  /** Stored and searchable through recall, just not injected this turn. */
  overflow: MemoryRow[];
  pinnedChars: number;
}

/**
 * Share of the budget reserved for per-child guarantees before anything
 * competes openly. Half: enough that no child can be crowded out, not so
 * much that family-wide rhythm facts lose their place.
 */
const MEMORY_CHILD_FLOOR_SHARE = 0.5;

/**
 * scoreMemoryForPinning(row, focusChildId): number
 * Higher wins a place in the prompt. Ordering only, never authority: the
 * budget decides how much rides, this decides what rides first.
 *
 * Recency is the spine, because a newer fact about a child is usually the
 * truer one. Two adjustments, each earned:
 *
 *   - what_works outranks fact at equal age. A fact ("Alma has read The
 *     Hobbit") is re-learnable from a conversation; hard-won teaching
 *     signal ("beat your own record framing, no countdown") is not.
 *   - the turn's focus child outranks everyone else's rows, because the
 *     parent is talking about that child right now.
 *
 * Deliberately NOT a model call. This runs on every turn of every channel,
 * and it has to return the same answer for the same store, or Homa knows
 * something on Monday and not on Tuesday. Judgment about what a memory is
 * WORTH belongs at write time, once, carried on the row. See the note on
 * selectPinnedMemories.
 */
function scoreMemoryForPinning(row: MemoryRow, focusChildId: string | null): number {
  const DAY = 24 * 60 * 60 * 1000;
  let score = memoryCreatedAtMs(row) / DAY;
  if (row.kind === "what_works") score += 30;
  if (focusChildId && row.child_id === focusChildId) score += 60;
  return score;
}

/** Greedy fill in score order, skipping rows already taken. Returns what
 *  fit and what it cost. Shared by the floor pass and the open pass. */
function fillFrom(
  ranked: MemoryRow[],
  taken: Set<string>,
  room: number,
): { picked: MemoryRow[]; used: number } {
  const picked: MemoryRow[] = [];
  let used = 0;
  for (const row of ranked) {
    if (taken.has(row.id)) continue;
    if (used + row.content.length > room) continue;
    picked.push(row);
    used += row.content.length;
    taken.add(row.id);
  }
  return { picked, used };
}

/**
 * selectPinnedMemories(rows, options): PinnedMemorySelection
 * Splits a family's active memories into the set that rides in the prompt
 * and the set that stays searchable.
 *
 * Two passes, and the first one is the point:
 *
 *   1. **Per-child floor.** Half the budget is split evenly among the
 *      children who have memories, and each child's best rows fill their
 *      own share first. This is what stops a chatty fortnight about one
 *      child from pushing a quieter sibling out of Homa's head entirely.
 *      Without it, pure ranking makes the loudest child the only child,
 *      which is the multi-kid failure the whole product exists to avoid.
 *   2. **Open fill.** Everything left over, family-wide rows included,
 *      competes for the remainder by score.
 *
 * Greedy within each pass: a long row that does not fit yields to shorter
 * ones behind it rather than stranding the space.
 *
 * Never throws and never drops: every input row lands in exactly one of
 * pinned or overflow.
 */
export function selectPinnedMemories(
  rows: MemoryRow[],
  options?: { focusChildId?: string | null; budget?: number },
): PinnedMemorySelection {
  const budget = options?.budget ?? FAMILY_MEMORY_CHAR_BUDGET;
  const focusChildId = options?.focusChildId ?? null;

  const ranked = [...rows].sort((a, b) => {
    const delta = scoreMemoryForPinning(b, focusChildId) - scoreMemoryForPinning(a, focusChildId);
    return delta !== 0 ? delta : a.id.localeCompare(b.id);
  });

  const childIds = [...new Set(rows.map((row) => row.child_id).filter((id): id is string => id !== null))];
  const taken = new Set<string>();
  const pinned: MemoryRow[] = [];
  let used = 0;

  if (childIds.length > 0) {
    const perChild = Math.floor((budget * MEMORY_CHILD_FLOOR_SHARE) / childIds.length);
    // Stable order so the floor pass cannot vary with row arrival order.
    for (const childId of [...childIds].sort()) {
      const mine = ranked.filter((row) => row.child_id === childId);
      const { picked, used: spent } = fillFrom(mine, taken, perChild);
      pinned.push(...picked);
      used += spent;
    }
  }

  const open = fillFrom(ranked, taken, budget - used);
  pinned.push(...open.picked);
  used += open.used;

  const overflow = rows.filter((row) => !taken.has(row.id));
  pinned.sort((a, b) => memoryCreatedAtMs(a) - memoryCreatedAtMs(b));
  return { pinned, overflow, pinnedChars: used };
}

/*
 * The contradiction guardrail lived here until 2026-07-21 and is gone on
 * purpose. It decided "does this new fact supersede that old one", a
 * judgment about meaning, using one scalar: cosine distance under 0.5,
 * calibrated on a single observed pair. AGENTS.md "Models judge, code
 * verifies" names that shape exactly: a guess wearing a number.
 *
 * Measured against the rows compaction merged on 2026-07-21 (a labelled
 * set, since they were merged for saying the same thing): true-conflict
 * distances ran 0.307 to 0.537, straddling the threshold, and 5 of 28
 * Gomes rows had no embedding at all, so they were invisible to it. Worse,
 * when it DID fire correctly (Ara's two reading-pace rows at 0.402) its
 * only output was advisory prose to a model mid-conversation, and that
 * duplicate pair still sat in every prompt for eleven days. Fleet-wide it
 * produced two superseded rows in the product's lifetime.
 *
 * Nothing replaces it here, because the replacement already exists and is
 * better placed: compaction (lib/learning/compact-memories.ts) proposes
 * merges with a model over the whole store and verifies them in code, off
 * the critical path with no parent waiting. It caught every pair this
 * guardrail missed. The agent also sees the family's whole memory list in
 * context every turn, so it never needed embedding math to notice a
 * duplicate; instructions.md tells it to forget the superseded one.
 */

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
