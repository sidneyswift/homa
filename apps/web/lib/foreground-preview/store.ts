import { randomUUID } from "node:crypto";
import { mapDb, type DbJson } from "../map/db";

export interface Owner { familyId: string; userId: string }
export type Status = "accepted" | "running" | "completed" | "cancelled" | "failed" | "interrupted";
export interface Turn {
  id: string; session_id: string; family_id: string; user_id: string;
  prompt: string; answer: string; status: Status; lease_id: string;
  event_sequence: number; error: string | null; created_at: string; projected_at: string | null;
}
export class PreviewConflict extends Error {}
export class PreviewNotFound extends Error {}
export class TurnNoLongerActive extends Error {}
export const activeStatus = (status: Status) => status === "accepted" || status === "running";

export function createTurnStore(sql = mapDb()) {
  async function read(owner: Owner, sessionId: string): Promise<Turn[]> {
    // A lost worker is never automatically rerun, and cannot append after expiry.
    await sql`
      update homa_fg_1171_20260914.turns set status='interrupted', finished_at=now(), error='The connection to the worker was lost. Saved text is preserved.'
      where session_id=${sessionId}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
      and ((status='running' and heartbeat_at < now()-interval '20 seconds')
        or (status='accepted' and created_at < now()-interval '30 seconds'))
    `;
    return await sql<Turn[]>`
      select * from homa_fg_1171_20260914.turns
      where session_id=${sessionId}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
      order by created_at,id limit 24
    `;
  }
  return {
    read,
    async accept(owner: Owner, sessionId: string, turnId: string, prompt: string) {
      return await sql.begin(async (tx) => {
        await tx`insert into homa_fg_1171_20260914.sessions(id,family_id,user_id)
          values(${sessionId}::uuid,${owner.familyId}::uuid,${owner.userId}::uuid) on conflict(id) do nothing`;
        const session = await tx`select id from homa_fg_1171_20260914.sessions
          where id=${sessionId}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid for update`;
        if (!session.length) throw new PreviewNotFound("Conversation unavailable");
        const existing = await tx<Turn[]>`select * from homa_fg_1171_20260914.turns
          where id=${turnId}::uuid and session_id=${sessionId}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid`;
        if (existing[0]) {
          if (existing[0].prompt !== prompt) throw new PreviewConflict("This send ID already belongs to a different question");
          return { claimed: false, turn: existing[0] };
        }
        const active = await tx`select id from homa_fg_1171_20260914.turns where session_id=${sessionId}::uuid and status in ('accepted','running')`;
        if (active.length) throw new PreviewConflict("This conversation already has an active answer");
        const count = await tx<{ count: number }[]>`select count(*)::int as count from homa_fg_1171_20260914.turns where session_id=${sessionId}::uuid`;
        if (count[0].count >= 20) throw new PreviewConflict("Preview conversation limit reached");
        const turns = await tx<Turn[]>`insert into homa_fg_1171_20260914.turns(id,session_id,family_id,user_id,prompt,status,lease_id)
          values(${turnId}::uuid,${sessionId}::uuid,${owner.familyId}::uuid,${owner.userId}::uuid,${prompt},'accepted',${randomUUID()}::uuid) returning *`;
        await tx`insert into homa_fg_1171_20260914.events(turn_id,sequence,event)
          values(${turnId}::uuid,0,${tx.json({ type: "question", text: prompt })})`;
        return { claimed: true, turn: turns[0] };
      });
    },
    async start(owner: Owner, turn: Turn) {
      const rows = await sql`update homa_fg_1171_20260914.turns set status='running',heartbeat_at=now()
        where id=${turn.id}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
        and lease_id=${turn.lease_id}::uuid and status='accepted' returning id`;
      return rows.length === 1;
    },
    async heartbeat(owner: Owner, turn: Turn) {
      const rows = await sql`update homa_fg_1171_20260914.turns set heartbeat_at=now()
        where id=${turn.id}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
        and lease_id=${turn.lease_id}::uuid and status='running' returning id`;
      return rows.length === 1;
    },
    async append(owner: Owner, turn: Turn, event: Record<string, unknown>, text = "") {
      const raw = JSON.stringify(event, (_key, value) => value instanceof Error ? { message: value.message } : value);
      if (raw.length > 100000) throw new Error("Preview event exceeds storage limit");
      await sql.begin(async (tx) => {
        const rows = await tx<{ event_sequence: number }[]>`
          update homa_fg_1171_20260914.turns
          set event_sequence=event_sequence+1, answer=answer || ${text}, heartbeat_at=now()
          where id=${turn.id}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
          and lease_id=${turn.lease_id}::uuid and status='running' and event_sequence<2500
          and length(answer)+length(${text})<=7000 returning event_sequence`;
        if (!rows[0]) throw new TurnNoLongerActive("Answer stopped or reached its preview limit");
        await tx`insert into homa_fg_1171_20260914.events(turn_id,sequence,event)
          values(${turn.id}::uuid,${rows[0].event_sequence},${tx.json(JSON.parse(raw) as DbJson)})`;
      });
    },
    async finish(owner: Owner, turn: Turn, status: "completed" | "failed", error: string | null = null) {
      await sql`update homa_fg_1171_20260914.turns set status=${status},error=${error},finished_at=now()
        where id=${turn.id}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
        and lease_id=${turn.lease_id}::uuid and status='running'`;
    },
    async markProjected(owner: Owner, turn: Turn) {
      await sql`update homa_fg_1171_20260914.turns set projected_at=now()
        where id=${turn.id}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid and answer=${turn.answer}`;
    },
    async cancel(owner: Owner, sessionId: string, turnId: string) {
      const rows = await sql`update homa_fg_1171_20260914.turns set status='cancelled',finished_at=now()
        where id=${turnId}::uuid and session_id=${sessionId}::uuid and family_id=${owner.familyId}::uuid and user_id=${owner.userId}::uuid
        and status in ('accepted','running') returning id`;
      return rows.length === 1;
    },
  };
}
export type TurnStore = ReturnType<typeof createTurnStore>;
