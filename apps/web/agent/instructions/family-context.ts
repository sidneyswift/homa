import { defineDynamic, defineInstructions } from "eve/instructions";

import {
  createCallerDbClient,
  MissingFamilyContextError,
  resolvePinnedFamilyId,
} from "../../lib/agent-db";
import { type MemoryRow } from "../../lib/agent-memory";
import {
  getChildProgressView,
  listActiveFamilyProgressCheckIns,
} from "../../lib/child-progress/runtime";
import {
  loadEnabledChildProgressAgentContext,
} from "../../lib/child-progress/agent-context";
import { loadContinuityContext } from "../../lib/conversation-continuity/ledger";
import {
  loadFamilyContextPinned,
  renderFamilyContext,
  type ChildAnswerRow,
  type ChildRow,
  type FamilyContextRows,
  type MemberRow,
} from "../../lib/family-context";
import { recordContextSnapshot } from "../../lib/observability/agent-trace";

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
 *   pinned · no token exists; the authenticated server channel stamped
 *            familyId, and reads run on the server connection pinned to
 *            that family. Interim until the M1-02 SET LOCAL role lands;
 *            familyId never comes from the model on either path.
 */

async function loadViaCallerToken(attributes: unknown): Promise<FamilyContextRows> {
  const { db, familyId } = createCallerDbClient(attributes);

  const [familyResult, childrenResult, memoriesResult, answersResult, membersResult] =
    await Promise.all([
      db
        .from("families")
        .select("name, us_state, parent_display_name, time_zone")
        .eq("id", familyId)
        .maybeSingle(),
      db
        .from("children")
        .select("id, name, birth_month, profile, avatar_url")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
      db
        .from("family_memories")
        .select("id, child_id, kind, content, source, created_at")
        .eq("family_id", familyId)
        .is("superseded_at", null)
        .in("kind", ["fact", "what_works"])
        .order("created_at", { ascending: true })
        .limit(200),
      // The map snapshot's raw material. RLS already walls these rows to
      // the caller's own children; the inner-join filter is the usual belt.
      db
        .from("child_answers")
        .select("child_id, question_id, answer, children!inner()")
        .eq("children.family_id", familyId),
      // The family roster (multi-parent v0): readable under the caller's
      // token since migration #49 widened the membership SELECT policy.
      db
        .from("family_members")
        .select("display_name")
        .eq("family_id", familyId)
        .order("created_at", { ascending: true }),
    ]);

  if (
    familyResult.error ||
    childrenResult.error ||
    memoriesResult.error ||
    answersResult.error ||
    membersResult.error
  ) {
    throw new Error("family context load failed under caller token");
  }
  return {
    family: familyResult.data,
    children: (childrenResult.data ?? []) as ChildRow[],
    memories: (memoriesResult.data ?? []) as MemoryRow[],
    answers: (answersResult.data ?? []) as unknown as ChildAnswerRow[],
    members: (membersResult.data ?? []) as MemberRow[],
  };
}

export default defineDynamic({
  events: {
    "turn.started": async (_event, ctx) => {
      const attributes = ctx.session.auth.current?.attributes as
        | {
            channel?: string;
            familyId?: string;
            supabaseAccessToken?: string;
            viewChildId?: string;
            memberName?: string;
            episodeId?: string;
            continuityContext?: string;
            familySmsInviteState?:
              | "pending"
              | "awaiting-parent"
              | "expired";
          }
        | undefined;

      // Fleet research sessions have no family on purpose; injecting the
      // "point the parent to /app" fallback would fight their whole job.
      if (attributes?.channel === "research") return null;
      // An invited adult has a deliberately unlinked, consent-only turn.
      // sms-mode owns that explanation; the generic setup fallback would
      // incorrectly route them into onboarding before they answer.
      if (attributes?.familySmsInviteState) return null;

      try {
        let rows: FamilyContextRows;
        const pinnedFamilyId = resolvePinnedFamilyId(attributes);
        if (attributes?.supabaseAccessToken) {
          rows = await loadViaCallerToken(attributes);
        } else if (pinnedFamilyId) {
          rows = await loadFamilyContextPinned(pinnedFamilyId);
        } else {
          throw new MissingFamilyContextError();
        }
        // The app's context switcher (web chat only; SMS and email have
        // no cookie). renderFamilyContext validates the id against the
        // family's own children, so a stale value renders nothing.
        // memberName is auth-context-derived by every channel (the
        // caller's own membership row, or the parent-written phone or
        // email mapping), never model input.
        const familyContext = renderFamilyContext(rows, {
          focusChildId: attributes?.viewChildId,
          speakingWith: attributes?.memberName ?? null,
        });
        let progressContext = "";
        if (attributes?.familyId) {
          try {
            progressContext =
              await loadEnabledChildProgressAgentContext(
              {
                familyId: attributes.familyId,
                childIds: rows.children.map((child) => child.id),
              },
              {
                listFamilyCheckIns:
                  listActiveFamilyProgressCheckIns,
                getChildProgressView,
              },
            );
          } catch (error) {
            // The established family context remains available when the new
            // progress read model is temporarily unavailable.
            console.error(
              "family context: child progress load failed:",
              error instanceof Error ? error.message : "unknown",
            );
          }
        }
        let continuityContext = attributes?.continuityContext ?? "";
        if (attributes?.familyId && continuityContext.length === 0) {
          try {
            continuityContext = await loadContinuityContext({
              familyId: attributes.familyId,
              episodeId: attributes.episodeId ?? null,
              runtimeSessionId: ctx.session.id,
            });
          } catch (error) {
            // Family context is the reliable floor. A continuity read
            // failure never makes the whole turn forget the family.
            console.error(
              "family context: continuity load failed:",
              error instanceof Error ? error.message : "unknown",
            );
          }
        }
        const markdown = [
          familyContext,
          progressContext,
          continuityContext,
        ]
          .filter((block) => block.length > 0)
          .join("\n\n");
        // Flight recorder (founder deep view): what this turn actually
        // carried. Fire-and-forget so assembly latency stays untouched;
        // the module dedupes per session and never throws.
        void recordContextSnapshot({
          familyId: attributes?.familyId ?? null,
          sessionId: ctx.session.id,
          // The dynamic-instructions callback context is typed without
          // `turn` (SessionContext has it, DynamicResolverContext does
          // not), so read it defensively; the recorder accepts null.
          turnId:
            (ctx.session as { turn?: { id?: string } }).turn?.id ?? null,
          channel: attributes?.channel ?? "web",
          content: markdown,
        });
        return defineInstructions({ markdown });
      } catch (error) {
        if (error instanceof MissingFamilyContextError) {
          return defineInstructions({
            markdown:
              "No family context is available on this session: the parent has not finished setup. Warmly point them to /app to set up their family first; do not guess at children or facts.",
          });
        }
        console.error(
          "family context load failed:",
          error instanceof Error ? error.message : "unknown",
        );
        return defineInstructions({
          markdown:
            "The family context could not be loaded this turn. Rely on the conversation itself, offer to try again, and avoid stating remembered facts you cannot see.",
        });
      }
    },
  },
});
