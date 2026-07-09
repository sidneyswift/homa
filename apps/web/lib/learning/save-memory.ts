import {
  FAMILY_MEMORY_CHAR_BUDGET,
  memoryUsageChars,
  scanMemoryContent,
} from "../agent-memory";
import { mapDb } from "../map/db";
import { embedText } from "./embeddings";

/**
 * The ONE guarded write path for server-side memory saves (the learning
 * loops and the voice remember tool). Applies exactly the invariants the
 * chat remember tool enforces under RLS, so a background or webhook write
 * is never more powerful than a foreground one:
 *
 *   - injection scan (scanMemoryContent, the M2-14 floor),
 *   - the family character budget (refuse when full, never evict),
 *   - exact-content dedupe,
 *   - child attribution only for a child inside THIS family (by id or by
 *     exact case-insensitive name).
 *
 * familyId always arrives from a server-side resolution (phone mapping,
 * session auth, webhook correlation), never from model output.
 */

/** 'homa' is the agent's own save (web uses the RLS tool path; SMS uses
 * this server path on the phone-mapping trust basis). */
export type ServerMemorySource = "call" | "review" | "homa";

export interface SaveMemoryInput {
  familyId: string;
  content: string;
  kind: "fact" | "what_works";
  source: ServerMemorySource;
  childId?: string | null;
  childName?: string | null;
}

export type SaveMemoryResult =
  | { saved: true; childId: string | null }
  | {
      saved: false;
      reason: "too-short" | "blocked-by-scan" | "duplicate" | "budget-full" | "unknown-child";
    };

export async function saveFamilyMemory(input: SaveMemoryInput): Promise<SaveMemoryResult> {
  const sql = mapDb();
  const content = input.content.trim();
  if (content.length < 4) return { saved: false, reason: "too-short" };

  const blocked = scanMemoryContent(content);
  if (blocked) return { saved: false, reason: "blocked-by-scan" };

  const [memories, children] = await Promise.all([
    // Active rows only: a superseded memory neither blocks re-adding a
    // corrected fact nor counts against the pinned budget.
    sql<{ content: string }[]>`
      select content from public.family_memories
      where family_id = ${input.familyId} and kind in ('fact', 'what_works')
        and superseded_at is null
    `,
    sql<{ id: string; name: string }[]>`
      select id, name from public.children where family_id = ${input.familyId}
    `,
  ]);

  if (memories.some((row) => row.content === content)) {
    return { saved: false, reason: "duplicate" };
  }
  if (memoryUsageChars(memories) + content.length > FAMILY_MEMORY_CHAR_BUDGET) {
    return { saved: false, reason: "budget-full" };
  }

  let childId: string | null = null;
  if (input.childId) {
    childId = children.find((child) => child.id === input.childId)?.id ?? null;
    if (!childId) return { saved: false, reason: "unknown-child" };
  } else if (input.childName) {
    const wanted = input.childName.trim().toLowerCase();
    childId = children.find((child) => child.name.trim().toLowerCase() === wanted)?.id ?? null;
    if (!childId) return { saved: false, reason: "unknown-child" };
  }

  // Best-effort semantic index; null just means FTS-only for this row.
  const embedding = await embedText(content);
  await sql`
    insert into public.family_memories (family_id, child_id, kind, content, source, embedding)
    values (${input.familyId}, ${childId}, ${input.kind}, ${content}, ${input.source}, ${embedding})
  `;
  return { saved: true, childId };
}
