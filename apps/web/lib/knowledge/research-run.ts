import { RESEARCH_STAGES } from "@homa/core";
import { z } from "zod";

import type { DemandCell } from "./demand";
import {
  KNOWLEDGE_LENSES,
  type KnowledgeLens,
  type KnowledgeTopicType,
} from "./gate";
import {
  canonicalResearchUrl,
  type PriorResearchDossier,
} from "./research-dedup";

export type ManualResearchRequest =
  | { kind: "queue"; count: number }
  | { kind: "cells"; cells: DemandCell[] };

export function topicTypeForLens(
  lens: KnowledgeLens,
): KnowledgeTopicType {
  switch (lens) {
    case "develops_when":
    case "how_to_teach":
    case "red_flags":
      return "subject";
    case "current_study":
      return "study";
    case "method":
      return "method_philosophy";
    case "curriculum":
      return "other";
    default: {
      const exhaustive: never = lens;
      throw new Error(`Unhandled knowledge lens: ${String(exhaustive)}`);
    }
  }
}

export function researchCellKey(cell: DemandCell): string {
  // Prior-source dedup spans every lens and stage for one topic, so the
  // concurrency lock must use that same scope. Two simultaneous lenses
  // for Dimensions Math would otherwise read the same prior snapshot and
  // could both choose the same new article.
  return `topic:${cell.topicKey}`;
}

/** Public project identity returned by the internal trigger so operator
 * scripts can prove their polling DB is the same Supabase project. */
export function supabaseProjectRef(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const match = /^([a-z0-9]+)\.supabase\.co$/u.exec(
      new URL(url).hostname.toLowerCase(),
    );
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

const LENS_GUIDANCE: Record<KnowledgeLens, string> = {
  develops_when:
    "Reference lens: what a child in THIS stage typically does in this skill line, age-anchored, from primary developmental sources. This is the stable what-to-expect picture, not a news roundup.",
  how_to_teach:
    "Practice lens: the current best guidance for TEACHING this skill line at THIS stage at home. Focus on what strong evidence says works, what changed recently, and common mistakes.",
  current_study:
    "Rolling scan: notable NEW early-childhood or homeschooling research from roughly the last 12 months that is relevant to THIS stage. Save only a finding that would change what a parent does.",
  method:
    "Research what practitioners of this homeschool philosophy or format actually do today, current providers and communities, recent evidence, and common mix-ups.",
  curriculum:
    "Research this curriculum or product: what it is, current editions and pricing, what evidence and reviews consistently say, and who it fits.",
  red_flags:
    "Research-only, never sent to a parent by text. Identify when a pattern in this skill line at this stage genuinely merits a professional look, using strong primary sources.",
};

const STAGE_LABEL: Record<string, string> = {
  early_years: "about ages 2 to 5",
  early_elem: "about ages 5 to 8",
  upper_elem: "about ages 8 to 11",
  middle: "about ages 11 to 14",
  high: "about ages 14 to 17",
};

function priorResearchBlock(prior: PriorResearchDossier): string {
  if (prior.rows.length === 0) {
    return `PRIOR RESEARCH FOR ${prior.topicKey}\nNo prior rows or citations are on file.`;
  }

  const findings = prior.rows
    .slice(0, 12)
    .map((row) => `- ${row.title}: ${row.summary}`);
  const usedPages = [
    ...new Map(
      prior.rows
        .flatMap((row) => row.citations)
        .map((citation) => [
          canonicalResearchUrl(citation.url),
          `${canonicalResearchUrl(citation.url)} | covered claim: ${citation.claim}`,
        ]),
    ).values(),
  ].slice(0, 40);
  return [
    `PRIOR RESEARCH FOR ${prior.topicKey}`,
    "Prior findings already covered:",
    ...findings,
    "",
    "Do not cite, fetch, or save any page listed below. Search engines may show it; skip it and choose a different specific page. Same website, different specific page is allowed.",
    ...usedPages.map((page) => `- ${page}`),
    "",
    "Produce a genuine delta: a new source AND a materially new claim. If the available web only repeats the prior findings, save nothing and say the cell has no new delta.",
  ].join("\n");
}

export function buildResearchMessage(
  cell: DemandCell,
  prior: PriorResearchDossier,
): string {
  const stageLine =
    cell.stage !== null
      ? `Stage: ${cell.stage} (${STAGE_LABEL[cell.stage] ?? "one developmental band"}).`
      : "Stage: not stage-specific.";
  return [
    `Research cell: ${cell.topicKey} · lens ${cell.lens}${cell.stage ? ` · stage ${cell.stage}` : ""}.`,
    stageLine,
    `${cell.demand} ${cell.demand === 1 ? "family currently needs" : "families currently need"} this cell${cell.hasRows ? ", and the bank already has prior work" : ", and the bank has no current row"}.`,
    "",
    LENS_GUIDANCE[cell.lens],
    "",
    priorResearchBlock(prior),
    "",
    `Follow the fleet-research rules, then save exactly one gated row with topicType "${cell.topicType}", topicKey "${cell.topicKey}", lens "${cell.lens}"${cell.stage ? `, and stage "${cell.stage}"` : ""}.`,
  ].join("\n");
}

export function buildResearchSessionInput(
  cell: DemandCell,
  runId: string,
  prior: PriorResearchDossier,
) {
  return {
    message: buildResearchMessage(cell, prior),
    target: { runId },
    auth: {
      authenticator: "fleet-research",
      principalId: `research:${runId}`,
      principalType: "user" as const,
      attributes: { channel: "research", taskRunId: runId },
    },
  };
}

export type ResearchTrigger = "scheduled" | "manual" | "lab";

interface ResearchRunDependencies {
  beginRun(
    title: string,
    options: { cellKey: string; trigger: ResearchTrigger },
  ): Promise<string | null>;
  loadPrior(
    topicKey: string,
    options: { excludeRunId: string },
  ): Promise<PriorResearchDossier>;
  startSession(
    input: ReturnType<typeof buildResearchSessionInput>,
  ): Promise<{ id: string }>;
  markSession(runId: string, sessionId: string): Promise<void>;
  failRun(runId: string, message: string): Promise<void>;
  onSessionRecordError?: (error: unknown) => void;
}

export type StartResearchCellResult =
  | {
      started: true;
      runId: string;
      sessionId: string;
      cellKey: string;
    }
  | {
      started: false;
      cellKey: string;
      reason: "already_running";
    };

/**
 * One entrance for scheduled, manual, and lab research. The database
 * run row reserves the cell before any model session starts; its unique
 * running-cell index is the cross-process lock that stops an hourly
 * backfill and a manual trigger from paying twice for the same work.
 */
export async function startResearchCell(
  cell: DemandCell,
  trigger: ResearchTrigger,
  dependencies: ResearchRunDependencies,
): Promise<StartResearchCellResult> {
  const cellKey = researchCellKey(cell);
  const title = `Research: ${cell.topicKey}${cell.stage ? ` (${cell.stage})` : ""}`;
  const runId = await dependencies.beginRun(title, { cellKey, trigger });
  if (!runId) {
    return { started: false, cellKey, reason: "already_running" };
  }

  let session: { id: string };
  try {
    const prior = await dependencies.loadPrior(cell.topicKey, {
      excludeRunId: runId,
    });
    session = await dependencies.startSession(
      buildResearchSessionInput(cell, runId, prior),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message.slice(0, 500) : "session startup failed";
    await dependencies.failRun(runId, message);
    throw error;
  }

  // The session is already durable at this point. A bookkeeping failure
  // must not mark the run failed, because that would release the unique
  // topic lock while the model continues working and permit a duplicate
  // retry. The channel still finishes the run; the stale-run reaper is
  // the fallback if the channel never completes.
  try {
    await dependencies.markSession(runId, session.id);
  } catch (error) {
    dependencies.onSessionRecordError?.(error);
  }
  return {
    started: true,
    runId,
    sessionId: session.id,
    cellKey,
  };
}

export function researchCompletionOutcome(input: {
  active: number;
  flagged: number;
  message: string | null | undefined;
}): {
  status: "done" | "failed" | "skipped";
  summary: string;
  error: string | undefined;
} {
  if (input.active > 0) {
    return {
      status: "done",
      summary: `${input.active} row${input.active === 1 ? "" : "s"} merged${input.flagged > 0 ? `, ${input.flagged} flagged by the gate` : ""}.`,
      error: undefined,
    };
  }
  if (
    input.flagged === 0 &&
    /\bNO_NEW_DELTA\s*$/u.test(input.message ?? "")
  ) {
    return {
      status: "skipped",
      summary: "No new research delta found.",
      error: undefined,
    };
  }
  return {
    status: "failed",
    summary: `0 rows merged${input.flagged > 0 ? `, ${input.flagged} flagged by the gate` : ""}.`,
    error: "no active row merged",
  };
}

const manualCellSchema = z.object({
  lens: z.enum(KNOWLEDGE_LENSES),
  topicKey: z.string().regex(/^[a-z0-9_-]{2,60}$/u),
  stage: z.enum(RESEARCH_STAGES).nullable().optional(),
});

const manualRequestSchema = z
  .object({
    count: z.number().int().min(1).max(20).optional(),
    cells: z.array(manualCellSchema).min(1).max(20).optional(),
    expectedProjectRef: z
      .string()
      .regex(/^[a-z0-9]{10,40}$/u)
      .optional(),
  })
  .strict();

export function parseManualResearchRequest(
  input: unknown,
): ManualResearchRequest {
  const parsed = manualRequestSchema.parse(input);
  if (parsed.count !== undefined && parsed.cells !== undefined) {
    throw new Error("Pass either count or cells, never both.");
  }
  if (parsed.cells) {
    return {
      kind: "cells",
      cells: parsed.cells.map((cell) => ({
        lens: cell.lens,
        topicKey: cell.topicKey,
        stage: cell.stage ?? null,
        topicType: topicTypeForLens(cell.lens),
        demand: 1,
        // Explicit cells deliberately bypass freshness selection. The
        // prior-research dossier and gate still prevent repeated work.
        hasRows: true,
      })),
    };
  }
  return { kind: "queue", count: parsed.count ?? 1 };
}
