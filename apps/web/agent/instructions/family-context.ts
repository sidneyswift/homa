import { defineDynamic, defineInstructions } from "eve/instructions";

import {
  createCallerDbClient,
  MissingFamilyContextError,
} from "../../lib/agent-db";
import { type MemoryRow } from "../../lib/agent-memory";
import {
  loadFamilyContextPinned,
  renderFamilyContext,
  type ChildRow,
  type FamilyContextRows,
} from "../../lib/family-context";

/**
 * Per-family dynamic context (M2-01/M2-02): the cloud equivalent of the
 * template's USER.md + children/*.json + MEMORY.md files. Resolves on
 * turn.started so every turn, in every session, starts already knowing the
 * family; nothing load-bearing lives in conversation history, which is what
 * makes session rotation and compaction safe (01-architecture.md).
 *
 * Two load paths, one wall (rendering + the pinned loader live in
 * lib/family-context, shared with the voice webhook):
 *   web  · the caller's own Supabase token (agent-db), RLS scopes rows.
 *   sms  · no token exists; the channel stamped familyId from the parent's
 *          own family_phones mapping (the SMS auth context), and reads run
 *          on the server connection pinned to that familyId. Interim until
 *          the M1-02 SET LOCAL role lands; familyId never comes from the
 *          model on either path.
 */

async function loadViaCallerToken(attributes: unknown): Promise<FamilyContextRows> {
  const { db, familyId } = createCallerDbClient(attributes);

  const [familyResult, childrenResult, memoriesResult] = await Promise.all([
    db
      .from("families")
      .select("name, us_state, parent_display_name")
      .eq("id", familyId)
      .maybeSingle(),
    db
      .from("children")
      .select("id, name, birth_month, profile")
      .eq("family_id", familyId)
      .order("created_at", { ascending: true }),
    db
      .from("family_memories")
      .select("id, child_id, kind, content, source, created_at")
      .eq("family_id", familyId)
      .in("kind", ["fact", "what_works"])
      .order("created_at", { ascending: true })
      .limit(200),
  ]);

  if (familyResult.error || childrenResult.error || memoriesResult.error) {
    throw new Error("family context load failed under caller token");
  }
  return {
    family: familyResult.data,
    children: (childrenResult.data ?? []) as ChildRow[],
    memories: (memoriesResult.data ?? []) as MemoryRow[],
  };
}

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const attributes = ctx.session.auth.current?.attributes as
        | { channel?: string; familyId?: string; supabaseAccessToken?: string }
        | undefined;

      try {
        let rows: FamilyContextRows;
        if (attributes?.supabaseAccessToken) {
          rows = await loadViaCallerToken(attributes);
        } else if (attributes?.channel === "sms" && attributes.familyId) {
          rows = await loadFamilyContextPinned(attributes.familyId);
        } else {
          throw new MissingFamilyContextError();
        }
        return defineInstructions({ markdown: renderFamilyContext(rows) });
      } catch (error) {
        if (error instanceof MissingFamilyContextError) {
          return defineInstructions({
            markdown:
              "No family context is available on this session: the parent has not finished setup. Warmly point them to /home to set up their family first; do not guess at children or facts.",
          });
        }
        return defineInstructions({
          markdown:
            "The family context could not be loaded this turn. Rely on the conversation itself, offer to try again, and avoid stating remembered facts you cannot see.",
        });
      }
    },
  },
});
