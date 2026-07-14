import { createHash } from "node:crypto";

import { RESEARCH_STAGES } from "@homa/core";
import { z } from "zod";

import { mapDb } from "../map/db";
import { emitMapEvent } from "../map/events";
import {
  findResearchDuplicates,
  loadPriorResearchWithDatabase,
} from "./research-dedup";

/**
 * The knowledge bank's one write path (D-ht-5: auto-merge behind an
 * automated gate; reconciles the education plan's speed-first ruling
 * with council S1 / M3-04). Every row a research session produces passes
 * through here before any family's brief can cite it:
 *
 *   1. schema validation (typed field caps, slug keys, citation shape);
 *   2. sanitization (invisible/bidi characters stripped, HTML stripped,
 *      em dashes replaced), because bank content re-enters prompts;
 *   3. citation resolution: every URL must answer on the live web,
 *      server-side. No resolving citations, no active row;
 *   4. content hash + run id, so scripts/knowledge-revert.mts can flag
 *      everything a bad run produced in one action.
 *
 * Failures land as status='flagged' rows (audit trail, invisible to
 * composition) rather than silent drops. BANNED_WORDS deliberately does
 * NOT run here: research prose legitimately says "assessment" or
 * "screening"; the parent-facing voice is enforced where parent-facing
 * words are written (the brief composer and its skill).
 */

export const KNOWLEDGE_TOPIC_TYPES = [
  "method_philosophy",
  "method_format",
  "subject",
  "study",
  "other",
] as const;
export type KnowledgeTopicType = (typeof KNOWLEDGE_TOPIC_TYPES)[number];

/**
 * The research purpose a row was gathered for (age-aware knowledge plan,
 * KC-2). Supersedes topic_type as the addressing axis; topic_type stays
 * for dual-read. Crossed with topic_key (a taxonomy domain for subjects)
 * and stage, a row's cell is (lens, topic_key, stage).
 */
export const KNOWLEDGE_LENSES = [
  "develops_when",
  "how_to_teach",
  "current_study",
  "method",
  "curriculum",
  "red_flags",
] as const;
export type KnowledgeLens = (typeof KNOWLEDGE_LENSES)[number];

/**
 * The freshness ceiling per lens, in days, set in code because the model
 * does not honor its own `freshnessTtlDays` argument (prod evidence
 * 2026-07-14: study rows carried 273-day TTLs, not the intended 14). A
 * row may shorten its TTL below the lens ceiling but never lengthen it
 * past it (D-kc-4). Lensless legacy rows fall back to the old 180 default.
 */
const LENS_TTL_DAYS: Record<KnowledgeLens, number> = {
  develops_when: 365,
  how_to_teach: 90,
  current_study: 14,
  method: 180,
  curriculum: 120,
  red_flags: 365,
};

/** The gated TTL for a row: the lens ceiling, shortened by the model's
 * request when it asked for less, never lengthened past the ceiling. */
export function ttlForRow(
  lens: KnowledgeLens | undefined,
  requested: number | undefined,
): number {
  const ceiling = lens ? LENS_TTL_DAYS[lens] : 180;
  return requested ? Math.min(requested, ceiling) : ceiling;
}

export const knowledgeRowInputSchema = z.object({
  topicType: z.enum(KNOWLEDGE_TOPIC_TYPES),
  topicKey: z
    .string()
    .regex(/^[a-z0-9_-]{2,60}$/, "kebab or snake case, 2 to 60 chars"),
  lens: z.enum(KNOWLEDGE_LENSES).optional(),
  stage: z.enum(RESEARCH_STAGES).optional(),
  title: z.string().trim().min(4).max(120),
  summary: z.string().trim().min(20).max(500),
  content: z.string().trim().min(40).max(8000),
  citations: z
    .array(
      z.object({
        url: z.string().url().max(500),
        accessedAt: z.string().max(20).optional(),
        claim: z.string().trim().min(4).max(200),
      }),
    )
    .min(1)
    .max(8),
  confidence: z.enum(["high", "medium", "low"]),
  sourceTier: z.number().int().min(1).max(4).optional(),
  freshnessTtlDays: z.number().int().min(1).max(3650).optional(),
});
export type KnowledgeRowInput = z.infer<typeof knowledgeRowInputSchema>;

/** Zero-width and bidirectional control characters: the classic invisible
 * prompt-injection carriers (M3-04's stripping requirement). */
const INVISIBLE_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

export function sanitizeKnowledgeText(text: string): string {
  return text
    .replace(INVISIBLE_CHARS, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2")
    .replace(/[\u2013\u2014]/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * A citation resolves when the URL answers on the live web. HEAD first,
 * GET on methods sites refuse. 403/405/429 count as resolving (the page
 * exists, the site just dislikes bots); 404/410 and 5xx do not.
 */
async function citationResolves(url: string): Promise<boolean> {
  const parsed = (() => {
    try {
      return new URL(url);
    } catch {
      return null;
    }
  })();
  if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
    return false;
  }
  const attempt = async (method: "HEAD" | "GET"): Promise<number | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "HomaResearchBot/1.0 (citation check)" },
      });
      return response.status;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
  const acceptable = (status: number): boolean =>
    (status >= 200 && status < 400) || status === 403 || status === 405 || status === 429;
  const headStatus = await attempt("HEAD");
  if (headStatus !== null && acceptable(headStatus)) return true;
  const getStatus = await attempt("GET");
  return getStatus !== null && acceptable(getStatus);
}

export interface MergeResult {
  merged: boolean;
  rowId?: string;
  /** True when an identical active row already existed; its freshness
   * clock was reset instead of writing a duplicate. */
  refreshed?: boolean;
  note: string;
}

export async function mergeKnowledgeRow(
  rawInput: unknown,
  options: {
    contributedBy: "seed" | "agent_research" | "founder";
    runId?: string | null;
  },
): Promise<MergeResult> {
  const parsed = knowledgeRowInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      merged: false,
      note: `Rejected before the gate: ${issue?.path.join(".")}: ${issue?.message}. Fix the field and retry.`,
    };
  }
  const input = parsed.data;

  const title = sanitizeKnowledgeText(input.title);
  const summary = sanitizeKnowledgeText(input.summary);
  const content = sanitizeKnowledgeText(input.content);
  const citations = input.citations.map((citation) => ({
    url: citation.url,
    accessedAt: citation.accessedAt ?? new Date().toISOString().slice(0, 10),
    claim: sanitizeKnowledgeText(citation.claim),
  }));

  const ttlDays = ttlForRow(input.lens, input.freshnessTtlDays);
  const lens = input.lens ?? null;
  const stage = input.stage ?? null;

  const sql = mapDb();
  const resolutions = await Promise.all(
    citations.map((citation) => citationResolves(citation.url)),
  );
  const dead = citations.filter((_, index) => !resolutions[index]);
  const contentHash = createHash("sha256")
    .update(`${title}\n${summary}\n${content}`)
    .digest("hex");
  type DatabaseOutcome =
    | { kind: "inactive" }
    | { kind: "flagged"; reason: string }
    | { kind: "refreshed"; rowId: string }
    | { kind: "inserted"; rowId: string };

  const outcome = await sql.begin<DatabaseOutcome>(async (transaction) => {
    // Serialize every write for one topic, including morning-brief
    // top-ups that do not use the fleet runner. This closes the
    // check-then-insert race where two lenses could choose the same new
    // article from the same prior snapshot.
    await transaction`
      select pg_advisory_xact_lock(hashtextextended(${input.topicKey}, 0))
    `;

    // Lock the run row until this transaction commits. Lab cancellation
    // updates the same row, so either cancellation wins first and this
    // write refuses, or this write commits first and cancellation waits,
    // then cleanup sees and flags the row. Dispatch top-up runs are valid
    // too; the requirement is status=running, not fleet_research kind.
    if (options.contributedBy === "agent_research" && options.runId) {
      const runs = await transaction<Array<{ status: string }>>`
        select status
        from public.homa_task_runs
        where id = ${options.runId}
        for update
      `;
      if (runs[0]?.status !== "running") return { kind: "inactive" };
    }

    let flagReason =
      dead.length > 0
        ? `citations did not resolve: ${dead.map((citation) => citation.url).join(", ")}`
        : null;

    // Prompt guidance keeps the model on a new path; this transaction
    // makes the promise deterministic. Seeds and founder-authored rows
    // retain their content-hash refresh path.
    if (!flagReason && options.contributedBy === "agent_research") {
      const prior = await loadPriorResearchWithDatabase(
        transaction,
        input.topicKey,
        { excludeRunId: options.runId ?? null },
      );
      const duplicates = findResearchDuplicates(citations, prior);
      if (duplicates.urls.length > 0 || duplicates.claims.length > 0) {
        const details = [
          duplicates.urls.length > 0
            ? `pages already used: ${duplicates.urls.slice(0, 3).join(", ")}`
            : null,
          duplicates.claims.length > 0
            ? `claims already covered: ${duplicates.claims.slice(0, 3).join(" | ")}`
            : null,
        ].filter((detail): detail is string => detail !== null);
        flagReason = `research duplicates prior work (${details.join("; ")})`;
      }
    }

    if (flagReason) {
      await transaction`
        insert into public.knowledge_bank
          (topic_type, topic_key, lens, stage, title, summary, content,
           source_tier, citations, confidence, contributed_by, status,
           flagged_reason, run_id, freshness_ttl_days)
        values
          (${input.topicType}, ${input.topicKey}, ${lens}, ${stage},
           ${title}, ${summary}, ${content}, ${input.sourceTier ?? null},
           ${transaction.json(citations as never)}, ${input.confidence},
           ${options.contributedBy}, 'flagged', ${flagReason},
           ${options.runId ?? null}, ${ttlDays})
      `;
      return { kind: "flagged", reason: flagReason };
    }

    const existing = await transaction<Array<{ id: string }>>`
      select id from public.knowledge_bank
      where topic_type = ${input.topicType} and topic_key = ${input.topicKey}
        and lens is not distinct from ${lens}
        and stage is not distinct from ${stage}
        and status = 'active' and content_hash = ${contentHash}
      limit 1
    `;
    if (existing[0]) {
      await transaction`
        update public.knowledge_bank
        set last_verified_at = now(), updated_at = now()
        where id = ${existing[0].id}
      `;
      return { kind: "refreshed", rowId: existing[0].id };
    }

    const inserted = await transaction<Array<{ id: string }>>`
      insert into public.knowledge_bank
        (topic_type, topic_key, lens, stage, title, summary, content,
         source_tier, citations, confidence, contributed_by, status,
         content_hash, run_id, freshness_ttl_days)
      values
        (${input.topicType}, ${input.topicKey}, ${lens}, ${stage},
         ${title}, ${summary}, ${content}, ${input.sourceTier ?? null},
         ${transaction.json(citations as never)}, ${input.confidence},
         ${options.contributedBy}, 'active', ${contentHash},
         ${options.runId ?? null}, ${ttlDays})
      returning id
    `;
    const rowId = inserted[0].id;

    // Supersede only the same cell. Topic-wide advisory locking prevents
    // cross-lens source races without collapsing distinct lens/stage rows.
    await transaction`
      update public.knowledge_bank
      set status = 'superseded', superseded_by = ${rowId}, updated_at = now()
      where topic_type = ${input.topicType} and topic_key = ${input.topicKey}
        and lens is not distinct from ${lens}
        and stage is not distinct from ${stage}
        and status = 'active' and id != ${rowId}
    `;
    return { kind: "inserted", rowId };
  });

  switch (outcome.kind) {
    case "inactive":
      return {
        merged: false,
        note:
          "This research run is no longer active, so its late result was not saved.",
      };
    case "flagged":
      await emitMapEvent("knowledge.row_merged", {
        topic_type: input.topicType,
        gate: "flagged",
      });
      return {
        merged: false,
        note: `Gate flagged this row: ${outcome.reason}. It is recorded for audit but no family will see it. Do not retry with the same citations.`,
      };
    case "refreshed":
      return {
        merged: true,
        refreshed: true,
        rowId: outcome.rowId,
        note:
          "An identical active entry already existed; its freshness clock was reset.",
      };
    case "inserted":
      await emitMapEvent("knowledge.row_merged", {
        topic_type: input.topicType,
        gate: "passed",
      });
      return {
        merged: true,
        rowId: outcome.rowId,
        note: "Merged into the shared knowledge bank.",
      };
    default: {
      const exhaustive: never = outcome;
      throw new Error(`Unhandled knowledge DB outcome: ${String(exhaustive)}`);
    }
  }
}

export interface KnowledgeRow {
  id: string;
  topicType: KnowledgeTopicType;
  topicKey: string;
  lens: KnowledgeLens | null;
  stage: string | null;
  title: string;
  summary: string;
  content: string;
  citations: Array<{ url: string; accessedAt?: string; claim: string }>;
  lastVerifiedAt: string;
}

/**
 * Fresh active rows relevant to one family's styles, subject frontiers,
 * and its kids' developmental stages, for the morning brief composer and
 * custom research tasks (age-aware knowledge plan, KC-4). Read-only,
 * server-side; family data goes IN to the filter, never into the bank.
 *
 * `subjectKeys` carries both taxonomy DOMAIN slugs (a child's frontier
 * domain, the new grain) and bare subject ids (legacy rows keyed before
 * KC-1), so a domain-keyed row and a legacy subject row both match.
 * `stages` is the set of the family's kids' stage bands; a row matches
 * when its stage is in that set OR is null (stage-agnostic and legacy
 * rows stay visible under dual-read). This is what stops a preschool
 * study from reaching an 11-year-old's family: the old query handed
 * every `study` row to everyone.
 */
export async function freshKnowledgeForTopics(topics: {
  styleKeys: string[];
  subjectKeys: string[];
  stages: string[];
  limit: number;
}): Promise<KnowledgeRow[]> {
  const sql = mapDb();
  const rows = await sql<
    {
      id: string;
      topic_type: KnowledgeTopicType;
      topic_key: string;
      lens: KnowledgeLens | null;
      stage: string | null;
      title: string;
      summary: string;
      content: string;
      citations: Array<{ url: string; accessedAt?: string; claim: string }>;
      last_verified_at: string;
    }[]
  >`
    select id, topic_type, topic_key, lens, stage, title, summary, content,
           citations, last_verified_at::text as last_verified_at
    from public.knowledge_bank
    where status = 'active'
      and (stage is null or stage = any(${sql.array(topics.stages)}))
      and (
        (topic_type in ('method_philosophy', 'method_format')
          and topic_key = any(${sql.array(topics.styleKeys)}))
        or (topic_type = 'subject' and topic_key = any(${sql.array(topics.subjectKeys)}))
        or topic_type = 'study'
      )
    order by last_verified_at desc
    limit ${topics.limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    topicType: row.topic_type,
    topicKey: row.topic_key,
    lens: row.lens,
    stage: row.stage,
    title: row.title,
    summary: row.summary,
    content: row.content,
    citations: row.citations,
    lastVerifiedAt: row.last_verified_at,
  }));
}
