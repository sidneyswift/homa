import { generateObject } from "ai";
import { z } from "zod";

import { HOMA_MODEL } from "../../agent/model";
import {
  FAMILY_MEMORY_CHAR_BUDGET,
  MEMORY_COMPACTION_TRIGGER_RATIO,
  MEMORY_ENTRY_MAX_CHARS,
  memoryUsageChars,
  scanMemoryContent,
} from "../agent-memory";
import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import { gatewayAttribution, recordModelUsage } from "../model-usage";
import { embedText } from "./embeddings";
import { MEMORY_COMPACTOR_PROMPT } from "./memory-compactor-prompt.generated";

/**
 * Memory compaction: the background pass that keeps a family's saved
 * memories worth carrying (founder ruling 2026-07-20,
 * memory-render-time-budget, and the 80% high-water trigger alongside it).
 *
 * Why this exists as a background job and not an in-turn scramble: the old
 * design asked the chat agent to consolidate mid-conversation, at the exact
 * moment a parent was waiting on a reply, on the one channel that could
 * even attempt it. It never once ran in production. Every family that
 * accumulated overlapping entries just kept them, so the prompt filled with
 * the same fact restated four times as a skill firmed up.
 *
 * Shape mirrors extract-memories.ts: one structured model pass, then
 * deterministic guarded writes. The model proposes; this module decides.
 * Nothing the model returns is trusted as an identifier: it sees indices
 * into a list WE built from THIS family's rows, so it cannot name another
 * family's memory even if it tries.
 *
 * Lossless by construction. Replaced rows are superseded, never deleted,
 * so a bad merge is visible in the Brain view and recoverable.
 */

/** One run may collapse at most this many groups (delta guard, M2-13
 *  posture). A store needing more than this gets the rest next run. */
export const MAX_MERGES_PER_COMPACTION = 6;

/** One run may unpack at most this many rows into per-child entries. */
export const MAX_SPLITS_PER_COMPACTION = 4;

/**
 * A split may grow the store, since the shared framing gets restated once
 * per child. Past this multiple of the original it is duplication, not
 * attribution, and the row is better left whole.
 */
const MAX_SPLIT_GROWTH_RATIO = 1.6;

/** Below this many active rows there is nothing worth a model pass. */
const MIN_ROWS_FOR_COMPACTION = 6;

/**
 * Ceiling on rows shown to the model in one pass. Storage is unbounded
 * now, so without this the compaction prompt grows with a family forever,
 * which is the same shape of bug as the context query that used to take
 * the oldest 200 rows. The nightly sweep works through the rest.
 */
const MAX_ROWS_PER_COMPACTION = 120;

/**
 * selectCompactionCandidates(rows, cap): ActiveRow[]
 * Trims to the cap by dropping WHOLE child-and-kind groups, largest first,
 * never by slicing a group in half.
 *
 * That shape is load-bearing: a merge is only ever legal inside one child
 * and one kind (validateMerge), so a group that survives arrives complete
 * and no merge opportunity is hidden by the trim. Cutting at an arbitrary
 * row instead would strand a stale entry in one pass and its correction in
 * the next, and the pair would never be seen together.
 */
export function selectCompactionCandidates(
  rows: ActiveRow[],
  cap: number = MAX_ROWS_PER_COMPACTION,
): ActiveRow[] {
  if (rows.length <= cap) return rows;

  const groups = new Map<string, ActiveRow[]>();
  for (const row of rows) {
    const key = `${row.child_id ?? "family"}:${row.kind}`;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  // Biggest groups first: redundancy concentrates where entries pile up,
  // so that is where a bounded pass buys the most.
  const ordered = [...groups.values()].sort((a, b) => b.length - a.length);
  const picked: ActiveRow[] = [];
  for (const group of ordered) {
    if (picked.length + group.length > cap) continue;
    picked.push(...group);
  }
  // Restore the stable read order the listing depends on.
  return picked.sort(
    (a, b) =>
      (a.child_id ?? "").localeCompare(b.child_id ?? "") ||
      a.kind.localeCompare(b.kind) ||
      a.created_at.localeCompare(b.created_at),
  );
}

/** Exported for the law tests: these rules are the guarantee, and they are
 *  worth asserting directly rather than only through a live model pass. */
export interface ActiveRow {
  id: string;
  child_id: string | null;
  kind: string;
  content: string;
  created_at: string;
}

export type MergeVerdict =
  | { ok: true; targets: ActiveRow[]; childId: string | null }
  | { ok: false; reason: string; detail: string };

export type SplitVerdict =
  | { ok: true; source: ActiveRow; parts: { content: string; childId: string }[] }
  | { ok: false; reason: string; detail: string };

export interface CompactionOutcome {
  familyId: string;
  /** Merges the model proposed. */
  proposed: number;
  /** Merges that survived validation and were written. */
  applied: { content: string; replaced: number }[];
  /** Packed rows unpacked into one entry per child. */
  unpacked: { from: string; into: string[] }[];
  /** Proposals rejected, with the rule that rejected them. */
  rejected: { reason: string; detail: string }[];
  charsBefore: number;
  charsAfter: number;
  model: string;
  durationMs: number;
}

const compactionSchema = z.object({
  merges: z
    .array(
      z.object({
        replaces: z
          .array(z.number().int().min(0))
          .min(2)
          .max(6)
          .describe("Numbers of the entries this replaces, from the list shown."),
        content: z
          .string()
          .min(4)
          // Deliberately looser than the real limit. The transport schema
          // only has to PARSE; MEMORY_ENTRY_MAX_CHARS is enforced in
          // validateMerge, which rejects one proposal instead of throwing
          // away the whole response. Cause: a merge 6 characters over 300
          // failed the entire pass, taking two flawless splits with it.
          .max(MEMORY_ENTRY_MAX_CHARS * 3)
          .describe(
            `One compact self-contained sentence saying everything they said, at most ${MEMORY_ENTRY_MAX_CHARS} characters.`,
          ),
        kind: z.enum(["fact", "what_works"]),
      }),
    )
    .max(MAX_MERGES_PER_COMPACTION)
    .describe("Groups of entries that say the same thing. An empty array is a correct answer."),
  splits: z
    .array(
      z.object({
        entry: z.number().int().min(0).describe("Number of the entry to unpack."),
        parts: z
          .array(
            z.object({
              childName: z
                .string()
                .min(1)
                .max(60)
                .describe("Exactly one child's name, spelled as the list shows it."),
              content: z
                .string()
                .min(4)
                // Loose here, enforced in validateSplit. See the note on
                // the merge content field.
                .max(MEMORY_ENTRY_MAX_CHARS * 3)
                .describe(
                  `That child's fact alone, standing on its own without the others, at most ${MEMORY_ENTRY_MAX_CHARS} characters.`,
                ),
            }),
          )
          .min(2)
          .max(4),
      }),
    )
    .max(MAX_SPLITS_PER_COMPACTION)
    .describe(
      "Entries holding separate facts about different children, one row per child. Only for separate facts, never for something the children genuinely do together. An empty array is a correct answer.",
    ),
});

function compactorPrompt(): string {
  return MEMORY_COMPACTOR_PROMPT;
}

export function compactionModel(): string {
  return process.env.HOMA_COMPACTION_MODEL ?? HOMA_MODEL;
}

/** The character count past which a family earns a compaction pass. */
export function compactionThresholdChars(): number {
  return Math.floor(FAMILY_MEMORY_CHAR_BUDGET * MEMORY_COMPACTION_TRIGGER_RATIO);
}

/**
 * Validates one proposed merge against every rule that must hold no
 * matter what the model returned. Returns the rows to supersede, or a
 * rejection reason.
 *
 * The multi-kid law is enforced HERE and not in the prompt, because a
 * prompt is guidance and this is a guarantee: a merge that spans two
 * children, or folds a child's fact into a family-wide one, cannot be
 * written no matter how the model was asked.
 */
export function validateMerge(
  merge: { replaces: number[]; content: string; kind: string },
  rows: ActiveRow[],
): MergeVerdict {
  const unique = [...new Set(merge.replaces)];
  if (unique.length < 2) {
    return { ok: false, reason: "too-few", detail: "a merge must replace at least two entries" };
  }
  const targets: ActiveRow[] = [];
  for (const index of unique) {
    const row = rows[index];
    // Out of range means the model invented a number. Every id we write
    // comes from this array, so an invented index simply has nothing
    // behind it and the whole merge is dropped.
    if (!row) {
      return { ok: false, reason: "unknown-entry", detail: `no entry numbered ${index}` };
    }
    targets.push(row);
  }

  const childIds = new Set(targets.map((row) => row.child_id));
  if (childIds.size > 1) {
    return {
      ok: false,
      reason: "cross-child",
      detail: "merge spanned more than one child, or mixed a child with the whole family",
    };
  }
  const kinds = new Set(targets.map((row) => row.kind));
  if (kinds.size > 1 || !kinds.has(merge.kind)) {
    return { ok: false, reason: "cross-kind", detail: "merge mixed fact with what_works" };
  }

  if (merge.content.length > MEMORY_ENTRY_MAX_CHARS) {
    return {
      ok: false,
      reason: "too-long",
      detail: `merged entry is ${merge.content.length} characters, over the ${MEMORY_ENTRY_MAX_CHARS} cap`,
    };
  }

  const blocked = scanMemoryContent(merge.content);
  if (blocked) {
    return { ok: false, reason: "blocked-by-scan", detail: blocked };
  }

  // The whole point is fewer characters. A merge that does not shrink the
  // store is churn: it supersedes real rows and buys nothing.
  const before = memoryUsageChars(targets);
  if (merge.content.length >= before) {
    return {
      ok: false,
      reason: "no-saving",
      detail: `merged entry (${merge.content.length}) is not shorter than the ${targets.length} it replaces (${before})`,
    };
  }

  return { ok: true, targets, childId: targets[0].child_id };
}

/**
 * Validates one proposed split: an entry holding separate facts about
 * different children, unpacked into one row per child.
 *
 * Attribution is the entire point, so the rules are strict about it. Each
 * part must name exactly one child who is really in THIS family, resolved
 * against rows we loaded, never against a name the model supplied. Two
 * parts may not claim the same child, or the "split" is just a rewrite.
 *
 * The growth guard is what keeps this honest: unpacking restates shared
 * framing once per child, and past MAX_SPLIT_GROWTH_RATIO that is
 * duplication wearing attribution's clothes. A genuinely joint fact
 * ("Axel and Mila are doing a 50 States unit together") fails it naturally,
 * because saying it twice costs far more than saying it once.
 */
export function validateSplit(
  split: { entry: number; parts: { childName: string; content: string }[] },
  rows: ActiveRow[],
  childIdByName: Map<string, string>,
): SplitVerdict {
  const source = rows[split.entry];
  if (!source) {
    return { ok: false, reason: "unknown-entry", detail: `no entry numbered ${split.entry}` };
  }
  // A row already filed to one child is attributed; unpacking it would
  // move facts out from under that child. Only unfiled rows are candidates.
  if (source.child_id !== null) {
    return {
      ok: false,
      reason: "already-attributed",
      detail: "entry is already filed under one child",
    };
  }

  const parts: { content: string; childId: string }[] = [];
  const claimedChildren = new Set<string>();
  for (const part of split.parts) {
    const childId = childIdByName.get(part.childName.trim().toLowerCase());
    if (!childId) {
      return {
        ok: false,
        reason: "unknown-child",
        detail: `"${part.childName}" is not a child in this family`,
      };
    }
    if (claimedChildren.has(childId)) {
      return {
        ok: false,
        reason: "duplicate-child",
        detail: `two parts both claim ${part.childName}`,
      };
    }
    const content = part.content.trim();
    if (content.length > MEMORY_ENTRY_MAX_CHARS) {
      return {
        ok: false,
        reason: "too-long",
        detail: `part for ${part.childName} is ${content.length} characters, over the ${MEMORY_ENTRY_MAX_CHARS} cap`,
      };
    }
    const blocked = scanMemoryContent(content);
    if (blocked) {
      return { ok: false, reason: "blocked-by-scan", detail: blocked };
    }
    claimedChildren.add(childId);
    parts.push({ content, childId });
  }

  const grown = parts.reduce((total, part) => total + part.content.length, 0);
  if (grown > source.content.length * MAX_SPLIT_GROWTH_RATIO) {
    return {
      ok: false,
      reason: "no-saving",
      detail: `parts total ${grown} against an original of ${source.content.length}, past the ${MAX_SPLIT_GROWTH_RATIO}x growth guard; likely a genuinely shared fact`,
    };
  }

  return { ok: true, source, parts };
}

export type CompactionProposal = z.infer<typeof compactionSchema>;

/**
 * proposeCompaction(rows, nameById, familyId)
 * The JUDGMENT step, isolated from all I/O on purpose (AGENTS.md "Models
 * judge, code verifies"): rows in, proposals out, no database, no writes.
 *
 * Keeping this separable is what makes the judgment measurable. The eval
 * (scripts/memory-compaction-eval.mts) calls it directly with fixture
 * rows, so accuracy is scored against real production language instead of
 * being assumed from the fact that the validators below have tests.
 *
 * Nothing here is trusted. Every proposal goes through validateMerge or
 * validateSplit before it can touch a row.
 */
export async function proposeCompaction(
  rows: ActiveRow[],
  nameById: Map<string, string>,
  familyId: string,
) {
  const listing = rows
    .map((row, index) => {
      const scope = row.child_id ? (nameById.get(row.child_id) ?? "a child") : "whole family";
      return `${index}. [${row.kind} · ${scope} · saved ${row.created_at.slice(0, 10)}] ${row.content}`;
    })
    .join("\n");

  return generateObject({
    model: compactionModel(),
    system: compactorPrompt(),
    prompt: [
      "This family's saved memories, numbered. Return merges and splits.",
      "",
      listing,
    ].join("\n"),
    schema: compactionSchema,
    // Generous on purpose. Sonnet 5 thinks before it answers, and that
    // reasoning comes out of the SAME output budget: a 2,000 cap was
    // spent entirely on thinking (1,999 tokens) and returned no object
    // at all, failing as finishReason "length". Compaction reads a whole
    // family's store and weighs entries against each other, which is
    // exactly the shape of task that thinks for a while.
    maxOutputTokens: 12000,
    // Structured output on this task is not reliably one-shot: observed
    // failing twice in a row locally against a real family store, once on
    // budget and once returning unparseable text with finishReason "stop".
    // Nothing waits on this pass, so spend the retries.
    maxRetries: 3,
    providerOptions: {
      gateway: {
        disallowPromptTraining: true,
        ...gatewayAttribution(familyId, "memory_compaction"),
      },
    },
  });
}

/**
 * Runs one compaction pass over a family's active memories.
 *
 * familyId always arrives from a server-side sweep over our own rows,
 * never from model output. Safe to call on a family that needs nothing:
 * it returns an empty outcome without writing.
 */
export async function compactFamilyMemories(
  familyId: string,
  options?: { dryRun?: boolean },
): Promise<CompactionOutcome> {
  const sql = mapDb();
  const model = compactionModel();
  const started = Date.now();

  const rows = await sql<ActiveRow[]>`
    select id, child_id, kind, content, created_at::text as created_at
    from public.family_memories
    where family_id = ${familyId} and kind in ('fact', 'what_works')
      and superseded_at is null
    order by child_id nulls first, kind, created_at
  `;

  const charsBefore = memoryUsageChars(rows);
  const outcome: CompactionOutcome = {
    familyId,
    proposed: 0,
    applied: [],
    unpacked: [],
    rejected: [],
    charsBefore,
    charsAfter: charsBefore,
    model,
    durationMs: 0,
  };
  if (rows.length < MIN_ROWS_FOR_COMPACTION) {
    outcome.durationMs = Date.now() - started;
    return outcome;
  }

  // Child names, so the model can keep the merged entry reading naturally.
  const children = await sql<{ id: string; name: string }[]>`
    select id, name from public.children where family_id = ${familyId}
  `;
  const nameById = new Map(children.map((child) => [child.id, child.name]));
  // Resolves a model-supplied name to an id INSIDE this family only, so a
  // split can never file a fact under a child who is not theirs.
  const childIdByName = new Map(
    children.map((child) => [child.name.trim().toLowerCase(), child.id]),
  );

  // Bounded, whole groups only. Indices below are into THIS array, and
  // validateMerge resolves against it too, so the two can never drift.
  const candidates = selectCompactionCandidates(rows);
  if (candidates.length < rows.length) {
    outcome.rejected.push({
      reason: "truncated",
      detail: `showed ${candidates.length} of ${rows.length} rows this pass; the rest follow on a later night`,
    });
  }

  const result = await proposeCompaction(candidates, nameById, familyId);

  await recordModelUsage({
    familyId,
    surface: "memory_compaction",
    model,
    modality: "text",
    inputTokens: result.usage.inputTokens,
    outputTokens: result.usage.outputTokens,
    durationMs: Date.now() - started,
    resourceKind: "family",
    resourceId: familyId,
  });

  outcome.proposed = result.object.merges.length + result.object.splits.length;

  // A row may only be claimed by one merge; a second claim on the same row
  // would supersede it twice and lose the first merge's meaning.
  const claimed = new Set<string>();

  for (const merge of result.object.merges) {
    const checked = validateMerge(merge, candidates);
    if (!checked.ok) {
      outcome.rejected.push({ reason: checked.reason, detail: checked.detail });
      continue;
    }
    if (checked.targets.some((row) => claimed.has(row.id))) {
      outcome.rejected.push({
        reason: "overlapping",
        detail: "another merge in this run already claimed one of these entries",
      });
      continue;
    }

    const content = merge.content.trim();

    if (options?.dryRun) {
      checked.targets.forEach((row) => claimed.add(row.id));
      outcome.applied.push({ content, replaced: checked.targets.length });
      continue;
    }

    const embedding = await embedText(content, {
      familyId,
      resourceKind: "family",
      resourceId: familyId,
    });
    const targetIds = checked.targets.map((row) => row.id);

    // Insert and supersede together: a crash between them would either
    // duplicate the knowledge or drop it, and both are worse than nothing.
    await sql.begin(async (tx) => {
      await tx`
        insert into public.family_memories
          (family_id, child_id, kind, content, source, embedding)
        values
          (${familyId}, ${checked.childId}, ${merge.kind}, ${content}, 'homa', ${embedding})
      `;
      await tx`
        update public.family_memories
        set superseded_at = now()
        where family_id = ${familyId}
          and id = any(${targetIds}::uuid[])
          and superseded_at is null
      `;
    });

    checked.targets.forEach((row) => claimed.add(row.id));
    outcome.applied.push({ content, replaced: checked.targets.length });
  }

  // Splits run after merges and honour the same claim set, so a row cannot
  // be merged away and unpacked in the same pass.
  for (const split of result.object.splits) {
    const checked = validateSplit(split, candidates, childIdByName);
    if (!checked.ok) {
      outcome.rejected.push({ reason: checked.reason, detail: checked.detail });
      continue;
    }
    if (claimed.has(checked.source.id)) {
      outcome.rejected.push({
        reason: "overlapping",
        detail: "a merge in this run already claimed this entry",
      });
      continue;
    }

    if (options?.dryRun) {
      claimed.add(checked.source.id);
      outcome.unpacked.push({
        from: checked.source.content,
        into: checked.parts.map((part) => part.content),
      });
      continue;
    }

    const embedded = await Promise.all(
      checked.parts.map(async (part) => ({
        ...part,
        embedding: await embedText(part.content, {
          familyId,
          resourceKind: "family",
          resourceId: familyId,
        }),
      })),
    );

    await sql.begin(async (tx) => {
      for (const part of embedded) {
        await tx`
          insert into public.family_memories
            (family_id, child_id, kind, content, source, embedding)
          values
            (${familyId}, ${part.childId}, ${checked.source.kind}, ${part.content},
             'homa', ${part.embedding})
        `;
      }
      await tx`
        update public.family_memories
        set superseded_at = now()
        where family_id = ${familyId}
          and id = ${checked.source.id}
          and superseded_at is null
      `;
    });

    claimed.add(checked.source.id);
    outcome.unpacked.push({
      from: checked.source.content,
      into: checked.parts.map((part) => part.content),
    });
  }

  if (options?.dryRun) {
    // Nothing was written, so project what the store WOULD weigh: every
    // merged entry in, every row it claimed out.
    const replaced = rows.filter((row) => claimed.has(row.id));
    const written =
      outcome.applied.reduce((sum, entry) => sum + entry.content.length, 0) +
      outcome.unpacked.reduce(
        (sum, entry) => sum + entry.into.reduce((parts, part) => parts + part.length, 0),
        0,
      );
    outcome.charsAfter = charsBefore - memoryUsageChars(replaced) + written;
    outcome.durationMs = Date.now() - started;
    return outcome;
  }

  const after = await sql<{ total: number | null }[]>`
    select sum(char_length(content))::int as total
    from public.family_memories
    where family_id = ${familyId} and kind in ('fact', 'what_works')
      and superseded_at is null
  `;
  outcome.charsAfter = after[0]?.total ?? 0;
  outcome.durationMs = Date.now() - started;

  if (outcome.applied.length > 0 || outcome.unpacked.length > 0) {
    await emitMapEvent("memory.compacted", {
      family_id: familyId,
      merges: outcome.applied.length,
      splits: outcome.unpacked.length,
      chars_before: charsBefore,
      chars_after: outcome.charsAfter,
    });
  }
  return outcome;
}

/**
 * Finds every family whose saved memories crossed the high-water mark and
 * compacts them. Exact by construction: the threshold is computed in SQL
 * over the live rows, so there is no marker column to drift out of sync
 * with reality and nothing to backfill.
 *
 * One family failing never stops the sweep.
 */
export async function sweepMemoryCompaction(options?: {
  limit?: number;
}): Promise<CompactionOutcome[]> {
  const sql = mapDb();
  const threshold = compactionThresholdChars();
  const limit = options?.limit ?? 20;

  const due = await sql<{ family_id: string }[]>`
    select family_id
    from public.family_memories
    where kind in ('fact', 'what_works') and superseded_at is null
    group by family_id
    having sum(char_length(content)) >= ${threshold}
    order by sum(char_length(content)) desc
    limit ${limit}
  `;

  const outcomes: CompactionOutcome[] = [];
  for (const row of due) {
    try {
      outcomes.push(await compactFamilyMemories(row.family_id));
    } catch (error) {
      console.error(
        `memory compaction failed for ${row.family_id}:`,
        error instanceof Error ? error.message : "unknown",
      );
    }
  }
  return outcomes;
}
