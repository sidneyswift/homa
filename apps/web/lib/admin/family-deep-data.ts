import {
  buildTrajectoryEras,
  type ArchivedScoring,
  type TrajectoryEra,
} from "../map/trajectory-eras";
import { getChildProgressView } from "../child-progress/runtime";
import type { ChildProgressView } from "../child-progress/types";
import { getTrajectoryEvidence } from "../map/store";
import { selectPinnedMemories } from "../agent-memory";
import { adminDb } from "./db";

/**
 * The family file's deep tabs (deep view direction 1): tasks with their
 * prompts, the brain (memories + what a session carries), materials
 * with generation provenance, and per-kid progress. All reads follow
 * the db.ts laws (sequential, ::text casts, json as text); the progress
 * loader additionally calls the same pure ChildProgress service the
 * parent page uses, so founder and family see one truth.
 */

export interface FamilyHeader {
  id: string;
  name: string;
  parentName: string | null;
  timeZone: string | null;
  kids: { id: string; name: string; birthDate: string }[];
}

export async function getFamilyHeader(familyId: string): Promise<FamilyHeader | null> {
  const sql = adminDb();
  const familyRows = await sql<
    { id: string; name: string; parent_display_name: string | null; time_zone: string | null }[]
  >`
    select id, name, parent_display_name, time_zone
    from public.families
    where id = ${familyId} and coalesce(status, 'open') <> 'deleted'
  `;
  const family = familyRows[0];
  if (!family) return null;
  const kids = await sql<{ id: string; name: string; birth_month: string }[]>`
    select id, name, birth_month::text as birth_month
    from public.children where family_id = ${familyId}
    order by created_at
  `;
  return {
    id: family.id,
    name: family.name,
    parentName: family.parent_display_name,
    timeZone: family.time_zone,
    kids: kids.map((kid) => ({ id: kid.id, name: kid.name, birthDate: kid.birth_month })),
  };
}

export interface FamilyTaskSchedule {
  id: string;
  kind: string;
  label: string | null;
  prompt: string | null;
  localHour: number;
  weekdays: number[];
  deliveryPref: string;
  paused: boolean;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdBy: string | null;
  recipientName: string | null;
}

export interface FamilyTaskRun {
  id: string;
  scheduleId: string | null;
  sessionId: string | null;
  kind: string;
  status: string;
  title: string;
  summary: string | null;
  error: string | null;
  deliveredChannel: string | null;
  scheduledFor: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export async function getFamilyTasks(familyId: string): Promise<{
  schedules: FamilyTaskSchedule[];
  runs: FamilyTaskRun[];
}> {
  const sql = adminDb();
  const schedules = await sql<
    {
      id: string;
      kind: string;
      label: string | null;
      prompt: string | null;
      local_hour: number;
      weekdays: string;
      delivery_pref: string;
      paused_at: string | null;
      enabled: boolean;
      next_run_at: string | null;
      last_run_at: string | null;
      created_by: string | null;
      recipient_name: string | null;
    }[]
  >`
    select s.id, s.kind, s.label, s.prompt, s.local_hour,
           to_json(s.weekdays)::text as weekdays,
           s.delivery_pref, s.paused_at::text as paused_at, s.enabled,
           s.next_run_at::text as next_run_at,
           s.last_run_at::text as last_run_at,
           s.created_by,
           coalesce(fm.display_name, u.email) as recipient_name
    from public.agent_schedules s
    left join public.family_members fm
      on fm.user_id = s.recipient_member_user_id and fm.family_id = s.family_id
    left join auth.users u on u.id = s.recipient_member_user_id
    where s.family_id = ${familyId}
    order by s.created_at
  `;
  const runs = await sql<
    {
      id: string;
      schedule_id: string | null;
      session_id: string | null;
      kind: string;
      status: string;
      title: string;
      summary: string | null;
      error: string | null;
      delivered_channel: string | null;
      scheduled_for: string | null;
      started_at: string;
      finished_at: string | null;
    }[]
  >`
    select id, schedule_id, session_id, kind, status, title, summary, error,
           delivered_channel, scheduled_for::text as scheduled_for,
           started_at::text as started_at, finished_at::text as finished_at
    from public.homa_task_runs
    where family_id = ${familyId}
    order by started_at desc
    limit 30
  `;
  return {
    schedules: schedules.map((row) => {
      let weekdays: number[] = [];
      try {
        weekdays = JSON.parse(row.weekdays) as number[];
      } catch {
        weekdays = [];
      }
      return {
        id: row.id,
        kind: row.kind,
        label: row.label,
        prompt: row.prompt,
        localHour: row.local_hour,
        weekdays,
        deliveryPref: row.delivery_pref,
        paused: row.paused_at !== null,
        enabled: row.enabled,
        nextRunAt: row.next_run_at,
        lastRunAt: row.last_run_at,
        createdBy: row.created_by,
        recipientName: row.recipient_name,
      };
    }),
    runs: runs.map((row) => ({
      id: row.id,
      scheduleId: row.schedule_id,
      sessionId: row.session_id,
      kind: row.kind,
      status: row.status,
      title: row.title,
      summary: row.summary,
      error: row.error,
      deliveredChannel: row.delivered_channel,
      scheduledFor: row.scheduled_for,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  };
}

export interface FamilyMemoryRow {
  id: string;
  childName: string | null;
  kind: string;
  content: string;
  source: string;
  sessionId: string | null;
  supersededAt: string | null;
  createdAt: string;
  /** Rides in the per-turn prompt. False means stored and searchable
   *  through recall, just not injected. Always false once superseded. */
  pinned: boolean;
}

export interface FamilyObservationRow {
  id: string;
  childName: string | null;
  quote: string;
  classification: string;
  status: string;
  channel: string;
  subjectHints: string[];
  usedAt: string | null;
  createdAt: string;
}

export interface FamilyBrain {
  memories: FamilyMemoryRow[];
  observations: FamilyObservationRow[];
  /** Everything Homa currently knows (unbounded). */
  activeChars: number;
  /** The slice that fits in a turn's prompt, capped by
   *  FAMILY_MEMORY_CHAR_BUDGET. Equals activeChars until a family
   *  outgrows the budget. */
  pinnedChars: number;
  latestSnapshot: {
    content: string;
    channel: string | null;
    sessionId: string;
    createdAt: string;
  } | null;
  reviews: { sessionId: string; result: unknown; createdAt: string }[];
}

export async function getFamilyBrain(familyId: string): Promise<FamilyBrain> {
  const sql = adminDb();
  const memories = await sql<
    {
      id: string;
      child_id: string | null;
      child_name: string | null;
      kind: string;
      content: string;
      source: string;
      session_id: string | null;
      superseded_at: string | null;
      created_at: string;
    }[]
  >`
    select m.id, m.child_id, c.name as child_name, m.kind, m.content, m.source,
           m.session_id, m.superseded_at::text as superseded_at,
           m.created_at::text as created_at
    from public.family_memories m
    left join public.children c on c.id = m.child_id
    where m.family_id = ${familyId}
    order by m.created_at desc
    limit 300
  `;
  const observations = await sql<
    {
      id: string;
      child_name: string | null;
      quote: string;
      classification: string;
      status: string;
      channel: string;
      subject_hints: string[];
      used_at: string | null;
      created_at: string;
    }[]
  >`
    select o.id, c.name as child_name, o.quote, o.classification,
           o.status, o.channel, o.subject_hints,
           o.used_at::text as used_at,
           o.created_at::text as created_at
    from public.child_observations o
    left join public.children c on c.id = o.child_id
    where o.family_id = ${familyId}
    order by o.created_at desc
    limit 100
  `;
  const snapshotRows = await sql<
    { content: string; channel: string | null; session_id: string; created_at: string }[]
  >`
    select content, channel, session_id, created_at::text as created_at
    from public.session_context_snapshots
    where family_id = ${familyId}
    order by created_at desc
    limit 1
  `;
  const reviews = await sql<
    { session_id: string; result: string | null; created_at: string }[]
  >`
    select session_id, result::text as result, created_at::text as created_at
    from public.learning_reviews
    where family_id = ${familyId}
    order by created_at desc
    limit 8
  `;
  // Two different numbers now, and the difference is the point: activeChars
  // is everything Homa knows, pinnedChars is the slice that rides in the
  // prompt this turn. Storage is unbounded; only the prompt is budgeted.
  const activeRows = memories.filter((row) => row.superseded_at === null);
  const activeChars = activeRows.reduce((sum, row) => sum + row.content.length, 0);
  const pinnedSelection = selectPinnedMemories(
    activeRows.map((row) => ({
      id: row.id,
      child_id: row.child_id,
      kind: row.kind,
      content: row.content,
      source: row.source,
      created_at: row.created_at,
    })),
  );
  const pinnedIds = new Set(pinnedSelection.pinned.map((row) => row.id));
  return {
    memories: memories.map((row) => ({
      id: row.id,
      childName: row.child_name,
      kind: row.kind,
      content: row.content,
      source: row.source,
      sessionId: row.session_id,
      supersededAt: row.superseded_at,
      createdAt: row.created_at,
      pinned: pinnedIds.has(row.id),
    })),
    observations: observations.map((row) => ({
      id: row.id,
      childName: row.child_name,
      quote: row.quote,
      classification: row.classification,
      status: row.status,
      channel: row.channel,
      subjectHints: row.subject_hints,
      usedAt: row.used_at,
      createdAt: row.created_at,
    })),
    activeChars,
    pinnedChars: pinnedSelection.pinnedChars,
    latestSnapshot: snapshotRows[0]
      ? {
          content: snapshotRows[0].content,
          channel: snapshotRows[0].channel,
          sessionId: snapshotRows[0].session_id,
          createdAt: snapshotRows[0].created_at,
        }
      : null,
    reviews: reviews.map((row) => {
      let result: unknown = null;
      try {
        result = row.result ? JSON.parse(row.result) : null;
      } catch {
        result = row.result;
      }
      return { sessionId: row.session_id, result, createdAt: row.created_at };
    }),
  };
}

export interface FamilyMaterialRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  source: string;
  skill: string | null;
  subject: string | null;
  theme: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
  revises: string | null;
  channel: string | null;
  generation: {
    sessionId?: string;
    turnId?: string;
    channel?: string;
    input?: Record<string, unknown>;
    // advisoryIssues is optional because it did not exist before
    // gh#368 and every row written until 2026-07-30 lacks it.
    review?: {
      pass: boolean;
      issues: string[];
      advisoryIssues?: string[];
    } | null;
  } | null;
  createdAt: string;
}

export async function getFamilyMaterialsDeep(familyId: string): Promise<FamilyMaterialRow[]> {
  const sql = adminDb();
  const rows = await sql<
    {
      id: string;
      title: string;
      kind: string;
      status: string;
      source: string;
      skill: string | null;
      subject: string | null;
      theme: string | null;
      child_name: string | null;
      preview_url: string;
      pdf_url: string;
      revises: string | null;
      channel: string | null;
      generation: string | null;
      created_at: string;
    }[]
  >`
    select m.id, m.title, m.kind, m.status, m.source, m.skill, m.subject,
           m.theme, c.name as child_name, m.preview_url, m.pdf_url,
           m.revises, m.channel, m.generation::text as generation,
           m.created_at::text as created_at
    from public.materials m
    left join public.children c on c.id = m.child_id
    where m.family_id = ${familyId}
    order by m.created_at desc
    limit 100
  `;
  return rows.map((row) => {
    let generation: FamilyMaterialRow["generation"] = null;
    try {
      generation = row.generation
        ? (JSON.parse(row.generation) as FamilyMaterialRow["generation"])
        : null;
    } catch {
      generation = null;
    }
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      status: row.status,
      source: row.source,
      skill: row.skill,
      subject: row.subject,
      theme: row.theme,
      childName: row.child_name,
      previewUrl: row.preview_url,
      pdfUrl: row.pdf_url,
      revises: row.revises,
      channel: row.channel,
      generation,
      createdAt: row.created_at,
    };
  });
}

export interface FamilyChildProgress {
  childId: string;
  childName: string;
  /** "YYYY-MM-DD", for the snapshot's meaning-box age sentence. */
  birthDate: string;
  view: ChildProgressView | null;
  eras: TrajectoryEra[];
  reportGeneratedAt: string | null;
  reportToken: string | null;
  evidence: {
    quote: string | null;
    source: string;
    channel: string | null;
    answer: string;
    itemId: string;
    createdAt: string;
  }[];
}

export async function getFamilyProgressDeep(
  familyId: string,
): Promise<FamilyChildProgress[]> {
  const sql = adminDb();
  const kids = await sql<{ id: string; name: string; birth_month: string }[]>`
    select id, name, birth_month::text as birth_month
    from public.children where family_id = ${familyId}
    order by created_at
  `;
  const reports = await sql<
    {
      child_id: string;
      token: string | null;
      scores: string;
      generated_at: string;
      history: string | null;
    }[]
  >`
    select child_id, token, scores::text as scores,
           generated_at::text as generated_at, history::text as history
    from public.child_reports
    where child_id in (select id from public.children where family_id = ${familyId})
  `;
  const evidence = await sql<
    {
      child_id: string;
      quote: string | null;
      source: string;
      channel: string | null;
      answer: string;
      item_id: string;
      created_at: string;
    }[]
  >`
    select child_id, quote, source, channel, answer, item_id,
           created_at::text as created_at
    from public.child_progress_evidence
    where family_id = ${familyId} and superseded_at is null
    order by created_at desc
    limit 40
  `;

  const reportByChild = new Map(reports.map((row) => [row.child_id, row]));
  const out: FamilyChildProgress[] = [];
  for (const kid of kids) {
    let view: ChildProgressView | null = null;
    try {
      view = await getChildProgressView(familyId, kid.id);
    } catch (error) {
      console.error(
        "admin family progress view failed:",
        error instanceof Error ? error.message : "unknown",
      );
    }
    const report = reportByChild.get(kid.id) ?? null;
    let eras: TrajectoryEra[] = [];
    if (report) {
      try {
        const history = (report.history ? JSON.parse(report.history) : []) as ArchivedScoring[];
        eras = buildTrajectoryEras({
          archived: [...history].reverse(),
          live: {
            generated_at: report.generated_at,
            scores: JSON.parse(report.scores),
          },
          evidence: await getTrajectoryEvidence(familyId, kid.id),
          birthDate: kid.birth_month,
        });
      } catch (error) {
        console.error(
          "admin family trajectory failed:",
          error instanceof Error ? error.message : "unknown",
        );
      }
    }
    out.push({
      childId: kid.id,
      childName: kid.name,
      birthDate: kid.birth_month,
      view,
      eras,
      reportGeneratedAt: report?.generated_at ?? null,
      reportToken: report?.token ?? null,
      evidence: evidence
        .filter((row) => row.child_id === kid.id)
        .slice(0, 8)
        .map((row) => ({
          quote: row.quote,
          source: row.source,
          channel: row.channel,
          answer: row.answer,
          itemId: row.item_id,
          createdAt: row.created_at,
        })),
    });
  }
  return out;
}
