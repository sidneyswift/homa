import { mapDb } from "../map/db";

/**
 * The first making's status, as the promise card reads it
 * (plans/2026-07-21-chat-first-onboarding.md §2.6).
 *
 * The card in the transcript is a POINTER, exactly like the checklist
 * card: it re-reads this on every mount and while it waits, because the
 * one thing it shows is the one thing still changing after it was
 * written. The phases are the card's whole vocabulary:
 *
 *   making   the job is queued or building; the promise stands
 *   ready    the material exists; show the real page, not a status
 *   stalled  the build parked and needs a hand; say so quietly,
 *            never in danger red (card contract error render)
 *   stopped  someone cancelled it; a stopped making is not a snag
 *
 * The mapping is pure and tested on its own; the read below only feeds
 * it rows.
 */

export type MakingPhase = "making" | "ready" | "stalled" | "stopped";

export function makingPhaseFor(
  jobStatus: string,
  hasMaterial: boolean,
): MakingPhase {
  if (jobStatus === "completed") {
    // Completed without a linked material means the record of what was
    // built is missing; a card that said "ready" with nothing to show
    // would be the lie, so it reads as stalled.
    return hasMaterial ? "ready" : "stalled";
  }
  if (jobStatus === "queued" || jobStatus === "running") return "making";
  // awaiting_input cannot happen for a never-gating single-stage build,
  // but a paused or steered job is still honestly "being worked out".
  if (jobStatus === "awaiting_input") return "making";
  if (jobStatus === "cancelled") return "stopped";
  // paused, or any status this module does not know: parked.
  return "stalled";
}

export interface MakingMaterial {
  id: string;
  title: string;
  kind: string | null;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  pageCount: number;
  pagePreviewUrls: string[];
}

export interface MakingStatus {
  phase: MakingPhase;
  material: MakingMaterial | null;
}

interface MakingRow {
  status: string;
  material_id: string | null;
  title: string | null;
  kind: string | null;
  skill: string | null;
  preview_url: string | null;
  pdf_url: string | null;
  generation: unknown;
  child_name: string | null;
}

function pageFacts(generation: unknown): {
  pageCount: number;
  pagePreviewUrls: string[];
} {
  if (!generation || typeof generation !== "object" || Array.isArray(generation)) {
    return { pageCount: 1, pagePreviewUrls: [] };
  }
  const record = generation as Record<string, unknown>;
  const pageCount =
    typeof record.pageCount === "number" && record.pageCount >= 1
      ? Math.floor(record.pageCount)
      : 1;
  const pagePreviewUrls = Array.isArray(record.pagePreviewUrls)
    ? record.pagePreviewUrls.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : [];
  return { pageCount, pagePreviewUrls };
}

/**
 * readMakingStatus(familyId, jobId): one family's view of one making.
 * The family always comes from the caller's session, never the request,
 * and the job id only matches inside that family (tenancy law). Null
 * means no such job here.
 */
export async function readMakingStatus(
  familyId: string,
  jobId: string,
): Promise<MakingStatus | null> {
  const sql = mapDb();
  const rows = await sql<MakingRow[]>`
    select j.status,
           m.id as material_id, m.title, m.kind, m.skill,
           m.preview_url, m.pdf_url, m.generation,
           c.name as child_name
    from public.agent_jobs j
    left join public.agent_job_stage_artifacts a
      on a.job_id = j.id and a.family_id = j.family_id and a.kind = 'material'
    left join public.materials m
      on m.id = a.material_id and m.family_id = j.family_id
      and m.status <> 'superseded'
    left join public.children c
      on c.id = m.child_id and c.family_id = j.family_id
    where j.id = ${jobId} and j.family_id = ${familyId}
    order by m.created_at desc nulls last
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  const hasMaterial = Boolean(
    row.material_id && row.title && row.preview_url && row.pdf_url,
  );
  const phase = makingPhaseFor(row.status, hasMaterial);
  if (!hasMaterial || phase !== "ready") return { phase, material: null };

  const { pageCount, pagePreviewUrls } = pageFacts(row.generation);
  return {
    phase,
    material: {
      id: row.material_id as string,
      title: row.title as string,
      kind: row.kind,
      skill: row.skill,
      childName: row.child_name ? row.child_name.split(/\s+/)[0] : null,
      previewUrl: row.preview_url as string,
      pdfUrl: row.pdf_url as string,
      pageCount,
      pagePreviewUrls,
    },
  };
}
