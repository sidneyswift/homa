import {
  parseActiveObjectReference,
  type ActiveObjectKind,
  type ActiveObjectReference,
} from "@homa/core";

import { mapDb } from "../map/db";

const MAX_CONTEXT_CHARS = 3_200;

export interface ActiveObjectRecord {
  kind: ActiveObjectKind;
  objectId: string;
  version: string;
  summary: Record<string, unknown>;
}

export interface ActiveObjectReader {
  read(
    familyId: string,
    reference: ActiveObjectReference,
  ): Promise<ActiveObjectRecord | null>;
}

export type ActiveObjectResolution =
  | {
      ok: true;
      reference: ActiveObjectReference;
      contextMarkdown: string;
    }
  | {
      ok: false;
      reason: "invalid" | "missing" | "stale";
    };

function boundedJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  return serialized.length <= MAX_CONTEXT_CHARS
    ? serialized
    : `${serialized.slice(0, MAX_CONTEXT_CHARS)}...`;
}

function contextFor(record: ActiveObjectRecord): string {
  const retrievalRule =
    record.kind === "material" || record.kind === "state_packet"
      ? "Before judging or revising it, load this exact material id with find_materials. Do not substitute a similarly named item."
      : "Use only this server-verified object when the parent says this, that, or the one on screen.";
  return [
    "## Visible object (server verified)",
    "",
    `The parent is currently looking at a ${record.kind} with id ${record.objectId}.`,
    retrievalRule,
    "The client supplied no family identity. This pointer was re-scoped through the authenticated family before reaching you.",
    `Bounded visible summary: ${boundedJson(record.summary)}`,
  ].join("\n");
}

function versionsMatch(left: string, right: string): boolean {
  if (left === right) return true;
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

async function readFromPostgres(
  familyId: string,
  reference: ActiveObjectReference,
): Promise<ActiveObjectRecord | null> {
  const sql = mapDb();
  if (reference.kind === "material" || reference.kind === "state_packet") {
    const rows = await sql<
      {
        id: string;
        version: string;
        title: string;
        kind: string;
        status: string;
        subject: string | null;
        skill: string | null;
        theme: string | null;
        child_id: string | null;
      }[]
    >`
      select id, created_at::text as version, title, kind, status,
             subject, skill, theme, child_id
      from public.materials
      where id = ${reference.objectId} and family_id = ${familyId}
        and (
          ${reference.kind === "material"}
          or subject in ('state-pack', 'state-filing')
        )
      limit 1
    `;
    const row = rows[0];
    return row
      ? {
          kind: reference.kind,
          objectId: row.id,
          version: row.version,
          summary: {
            title: row.title,
            kind: row.kind,
            status: row.status,
            subject: row.subject,
            skill: row.skill,
            theme: row.theme,
            childId: row.child_id,
          },
        }
      : null;
  }

  if (reference.kind === "plan") {
    const rows = await sql<
      {
        id: string;
        version: string;
        child_id: string;
        child_name: string;
        subject_id: string;
        plan: unknown;
      }[]
    >`
      select plan.id, plan.updated_at::text as version,
             plan.child_id, child.name as child_name, plan.subject_id,
             plan.plan
      from public.child_plans plan
      join public.children child
        on child.id = plan.child_id and child.family_id = ${familyId}
      where plan.id = ${reference.objectId}
      limit 1
    `;
    const row = rows[0];
    return row
      ? {
          kind: reference.kind,
          objectId: row.id,
          version: row.version,
          summary: {
            childId: row.child_id,
            childName: row.child_name,
            subjectId: row.subject_id,
            plan: row.plan,
          },
        }
      : null;
  }

  if (reference.kind === "recording") {
    const rows = await sql<
      {
        id: string;
        version: string;
        child_id: string;
        status: string;
        source: string;
        started_at: string;
        finished_at: string | null;
        duration_seconds: number | null;
      }[]
    >`
      select id, created_at::text as version, child_id, status, source,
             started_at::text as started_at, finished_at::text as finished_at,
             duration_seconds
      from public.lesson_recordings
      where id = ${reference.objectId} and family_id = ${familyId}
      limit 1
    `;
    const row = rows[0];
    return row
      ? {
          kind: reference.kind,
          objectId: row.id,
          version: row.version,
          summary: {
            childId: row.child_id,
            status: row.status,
            source: row.source,
            startedAt: row.started_at,
            finishedAt: row.finished_at,
            durationSeconds: row.duration_seconds,
          },
        }
      : null;
  }

  if (reference.kind === "calendar_preview") {
    const rows = await sql<
      {
        id: string;
        version: string;
        child_id: string | null;
        title: string;
        starts_on: string;
        ends_on: string;
        start_time: string | null;
        end_time: string | null;
        note: string | null;
      }[]
    >`
      select id, created_at::text as version, child_id, title,
             starts_on::text as starts_on, ends_on::text as ends_on,
             start_time::text as start_time, end_time::text as end_time, note
      from public.family_events
      where id = ${reference.objectId} and family_id = ${familyId}
      limit 1
    `;
    const row = rows[0];
    return row
      ? {
          kind: reference.kind,
          objectId: row.id,
          version: row.version,
          summary: {
            childId: row.child_id,
            title: row.title,
            startsOn: row.starts_on,
            endsOn: row.ends_on,
            startTime: row.start_time,
            endTime: row.end_time,
            note: row.note,
          },
        }
      : null;
  }

  if (reference.kind === "task") {
    const rows = await sql<
      {
        id: string;
        version: string;
        kind: string;
        label: string | null;
        prompt: string | null;
        local_hour: number;
        weekdays: number[];
        delivery_pref: string;
        enabled: boolean;
        paused: boolean;
      }[]
    >`
      select id, created_at::text as version, kind, label, prompt,
             local_hour, weekdays, delivery_pref, enabled,
             paused_at is not null as paused
      from public.agent_schedules
      where id = ${reference.objectId} and family_id = ${familyId}
      limit 1
    `;
    const row = rows[0];
    return row
      ? {
          kind: reference.kind,
          objectId: row.id,
          version: row.version,
          summary: {
            kind: row.kind,
            label: row.label,
            prompt: row.prompt,
            localHour: row.local_hour,
            weekdays: row.weekdays,
            deliveryPreference: row.delivery_pref,
            enabled: row.enabled,
            paused: row.paused,
          },
        }
      : null;
  }

  // photo_proposal has no durable production object yet. The typed kind is
  // reserved for that future surface, but resolution fails closed today.
  return null;
}

const POSTGRES_READER: ActiveObjectReader = { read: readFromPostgres };

export async function resolveActiveObject(
  familyId: string,
  value: unknown,
  reader: ActiveObjectReader = POSTGRES_READER,
): Promise<ActiveObjectResolution> {
  const reference = parseActiveObjectReference(value);
  if (!reference) return { ok: false, reason: "invalid" };
  const record = await reader.read(familyId, reference);
  if (!record) return { ok: false, reason: "missing" };
  if (!versionsMatch(record.version, reference.version)) {
    return { ok: false, reason: "stale" };
  }
  return {
    ok: true,
    reference,
    contextMarkdown: contextFor(record),
  };
}
