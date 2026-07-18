# Conversation Reliability Foundation and Honest Thread Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six confirmed conversation reliability failures, add a PII-minimized health audit, and ship durable material generation as one honest work object that completes inside the parent’s existing thread.

**Architecture:** First correct the canonical conversation, reply, progress-loop, material-history, and dispatch contracts without feature flags. Then add an additive, flag-dark material job ledger. An enqueue tool writes one durable job, a separate dispatch-style Eve session performs the existing materials-studio workflow under pinned tenancy, and completion writes a canonical message plus delivery into the original member and episode. The web client polls only while a known job is active and replaces the inline work object with the latest passing material.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, Eve 0.19.0, Supabase Postgres, postgres.js, Vercel Blob, Telnyx, Zod, Node test runner, pnpm, Turborepo.

## Global Constraints

- Start from worktree `/Users/sidneyswift/Documents/Projects/Sidney/homa/.worktrees/conversation-reliability` at production main commit `a04b6d5`.
- Fix F1 through F6 test-first. Foundation fixes are unflagged and independently deployable.
- The selected parent experience is **One honest thread**. One work object replaces itself. The composer and existing visible message queue remain available.
- Material generation is a durable background job from the moment enqueue succeeds. The 60-second threshold changes presentation only, from inline work to persistent work. It never migrates, restarts, or replaces an in-flight Eve turn.
- Stage background execution only for material generation. Existing quick actions such as showing an existing material and finalizing an approved material stay inline.
- The root materials-studio flow calls the smallest deterministic enqueue primitive and ends quickly. A separate dispatch-style session loads materials-studio and calls the existing image, render, review, storage, and delivery tools.
- A background session cannot enqueue another background job.
- Background completion writes `conversation_messages` and `conversation_deliveries` in the originating member and episode. It never sends a result into the live root Eve session.
- Background execution is a delivery mode for existing material actions, not a separately billable capability. Add typed lifecycle events. Keep existing chat, image, review, render, and material usage telemetry as cost truth. Do not add an action-cost row, credit amount, or invented price.
- Poll only while at least one known job is active. An open tab receives terminal state without reload, then polling stops. Do not add Supabase Realtime.
- Parent history shows one latest passing or final material per revision chain. Failed attempts remain visible in founder admin traces. F4 adds no material schema column.
- Keep the binding four-block microscope research brief. Both skill and validator use a 600-character maximum. Validate before any transport. Length failure sends neither SMS nor fallback email.
- Preserve the D7 footer, `made with Homa for [child]`, in every generated PDF.
- Create migrations during implementation with `supabase migration new`. Migrations are additive. Roll out code first with background execution and polling flags dark, then apply migrations.
- `familyId` always comes from authenticated context or an authenticated transport mapping. Re-scope every child, material, message, member, episode, and delivery identifier inside that family.
- Do not mutate a real family’s progress during tests or production verification.
- No em dash in code, comments, docs, copy, SQL comments, or commit messages.
- Imports stay at the top. No inline imports.
- Every TypeScript switch over a union or enum has a `never` default.
- Add no dependency unless the existing stack cannot perform the exact effect. This plan requires no new dependency.
- The repository has no `project-overview.md` at this commit. `README.md` is the canonical repo map. Update its Repo map rows when the new operational scripts and material-job module land.
- Every task starts with a failing test, records the exact RED and GREEN commands in its report, ends with one reviewable commit, and receives a clean task review before the next task starts.

---

## Preflight conflict review

**Verdict: no unresolved conflicts remain.** The founder ruling in this conversation resolves every build-changing contradiction:

1. The July 13 background-work direction treated 60 seconds as the point where work might leave a blocking turn. Current policy says material work is durable at enqueue. Sixty seconds is now only the UI escalation threshold.
2. The July 13 direction described background work as a possible new billable action and requested an action-cost entry. Current policy says this is a delivery mode for existing material actions. Lifecycle events are required, but no action-cost entry or credit amount is allowed.
3. The current materials-studio skill says web material work stays in the same turn. Current policy supersedes that sentence when the background flag is on. Flag-off behavior remains the code-first compatibility path.
4. Eve child agents still block their parent turn. They are not the background mechanism. A separate root channel session is the background mechanism.
5. The original “One honest thread” direction called background work optional. The selected direction now includes the narrow material background lane.
6. D7 remains unchanged. The work card, an ink-saving presentation, and background execution cannot remove the PDF footer.

## Locked domain decisions

### Canonical message precedence

For one `(session_id, coalesce(turn_id, ''), role, sequence)` key:

- A nonterminal assistant write may create the first row.
- A later terminal assistant write replaces `content` and `created_at`.
- A terminal replacement clears the old embedding, then writes the embedding generated from terminal text.
- A replayed nonterminal event cannot overwrite terminal content or demote family visibility.

### Material revision visibility

For each connected `materials.revises` chain:

1. Prefer the newest `status = 'final'` row.
2. Otherwise show the newest non-superseded row whose review is absent or passed.
3. Never show a review-failed row as a ready card.
4. Keep every row in founder admin data.
5. Use existing `status`, `revises`, `created_at`, and `generation.review`. Add no F4 column.

### Material job states

```ts
export const MATERIAL_JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
] as const;

export type MaterialJobStatus =
  (typeof MATERIAL_JOB_STATUSES)[number];

export const MATERIAL_JOB_DELIVERY_STATUSES = [
  "pending",
  "sent",
  "failed",
] as const;

export type MaterialJobDeliveryStatus =
  (typeof MATERIAL_JOB_DELIVERY_STATUSES)[number];
```

- `queued`: durable row exists and no worker owns it.
- `running`: one worker claimed it and may have started a durable Eve session.
- `completed`: a passing or final material exists. Delivery truth stays in `deliveryStatus`.
- `failed`: no passing result can be shown.
- A stale `running` job becomes `failed`. It is never reset to `queued`.

### Parent presentation states

```ts
export type MaterialJobPresentation =
  | { kind: "inline"; label: "Designing" }
  | { kind: "persistent"; label: "Still working" }
  | { kind: "ready"; label: "Ready" }
  | { kind: "failed"; label: "Needs another try" };
```

`queued` and `running` are inline for the first 60,000 ms. They become persistent after that same job has remained active for 60,000 ms. No server state changes at that boundary.

## File map

### Common foundation

- Modify `apps/web/agent/hooks/persist-conversation.ts`: skip parented Eve sessions and emit PII-free delegated lineage metadata.
- Modify `apps/web/agent/hooks/continuity-web-delivery.ts`: skip parented Eve sessions before persistence or web delivery.
- Create `apps/web/lib/conversation-continuity/session-lineage.ts`: parent-session guard and SHA-256 lineage metadata.
- Create `apps/web/lib/conversation-continuity/session-lineage.test.ts`: F1 unit contract.
- Create `scripts/parented-session-continuity-e2e.mts`: prove the root receives a child result while child rows and deliveries stay absent.
- Modify `packages/core/src/events.ts` and `packages/core/src/events.test.ts`: register `conversation.session_delegated`.
- Modify `apps/web/lib/conversation-continuity/ledger.ts`: terminal-aware canonical update.
- Modify `apps/web/lib/conversation-log.ts`: replace terminal embeddings.
- Create `apps/web/lib/conversation-log.test.ts`: terminal embedding dependency test.
- Modify `scripts/conversation-continuity-e2e.mts`: F2 row, time, replay, and embedding reset assertions.
- Modify `apps/web/lib/child-progress/repository.ts`, `check-in-service.ts`, `postgres-repository.ts`, and `check-in-service.test.ts`: cancel superseded progress reply loops.
- Modify `scripts/child-progress-postgres-test.mts`: F3 transactional and migration assertions.
- Create through the Supabase CLI an additive migration ending in `_conversation_progress_loop_cleanup.sql`: database trigger and safe stale-loop backfill.
- Create `apps/web/lib/materials/parent-visible.ts` and `.test.ts`: F4 chain selection.
- Create `apps/web/app/app/material-message-parts.ts` and `.test.ts`: live tool-output selection.
- Modify `apps/web/lib/chat-history.ts`, `chat-history-model.ts`, and `chat-history-model.test.ts`: parent history revision truth.
- Modify `apps/web/agent/tools/create_printable.ts` and `apps/web/app/app/message-parts.tsx`: include lineage and suppress failed ready cards.
- Modify `apps/web/lib/tasks/research-brief-format.ts`, `.test.ts`, `task-delivery.ts`, and `task-delivery.test.ts`: 600-character gate and no fallback.
- Create `apps/web/lib/tasks/output-gate.ts` and `.test.ts`: task-kind runtime gate.
- Modify `apps/web/agent/channels/dispatch.ts`: invoke the gate before persistence or transport.
- Modify `apps/web/agent/skills/research-brief/SKILL.md`: align the written limit.
- Modify `apps/web/lib/conversation-continuity/continuity-service.ts`, `reply-policy.ts`, and their tests: foreground an exact target.
- Modify `scripts/conversation-continuity-model-eval.mts`: competing-topic behavioral regression.

### Health audit

- Create `scripts/conversation-health-audit-lib.ts`: pure classifiers and PII-minimized findings.
- Create `scripts/conversation-health-audit.test.ts`: July 15 synthetic fixture covering every required finding.
- Create `scripts/conversation-health-audit.mts`: explicit-database operational command.
- Modify `package.json`: add `conversation:health` and include the pure test in `check:continuity`.
- Modify `README.md`: document the audit command.

### Durable material backend

- Create through the Supabase CLI an additive migration ending in `_material_background_jobs.sql`: job ledger, indexes, checks, and per-recipient read policy.
- Create `apps/web/lib/material-jobs/types.ts`, `flag.ts`, `store.ts`, `dispatch-input.ts`, `completion.ts`, and their tests.
- Create `scripts/material-jobs-postgres-test.mts`: disposable PostgreSQL lifecycle and isolation E2E.
- Create `apps/web/agent/tools/enqueue_material_job.ts`: smallest enqueue primitive.
- Create `apps/web/agent/channels/material-background.ts`: separate durable execution and terminal delivery.
- Create `apps/web/agent/schedules/material-background.ts`: active flag-dark claimant and stale-job reaper.
- Modify `apps/web/agent/skills/materials-studio/SKILL.md`: root enqueue branch and background execution branch.
- Modify `apps/web/agent/instructions/sms-mode.ts`: background enqueue replaces the old wait-message path when enabled.
- Modify `apps/web/lib/materials/delivery.ts`, `create_printable.ts`, and `show_material.ts`: shared SMS artifact delivery.
- Modify `packages/core/src/events.ts` and `events.test.ts`: typed job lifecycle events.
- Modify `apps/web/.env.example`: dark execution and polling flags.
- Modify `package.json`: material-job E2E and behavioral eval commands.

### One honest thread

- Create `apps/web/app/api/material-jobs/active/route.ts`: caller-authenticated active/recent job read.
- Create `apps/web/app/app/material-job-state.ts` and `.test.ts`: 60-second presentation and active-only polling policy.
- Create `apps/web/app/app/material-work-item.tsx` and `.test.tsx`: accessible compact work object.
- Modify `apps/web/app/app/material-card.tsx`: expose one shared unframed artifact body.
- Modify `apps/web/lib/chat-history.ts` and `chat-history-model.ts`: include job objects and consume their result message/material exactly once.
- Modify `apps/web/app/app/message-parts.tsx`: render `enqueue_material_job`.
- Modify `apps/web/app/app/chat-client.tsx`: merge poll updates and preserve composer/queue behavior.
- Modify `apps/web/app/app/page.tsx`: pass polling flag and initial jobs.
- Create `apps/web/app/app/chat-client-material-jobs.test.ts`: source wiring and queue regression.
- Modify `README.md`: add the material-job module and one-honest-thread rows.

### Repair and ruling record

- Create `scripts/conversation-reliability-repair-lib.ts`, `.test.ts`, and `conversation-reliability-repair.mts`: exact-session visibility repair, child-delivery cleanup, and stale-loop cancellation with dry-run default.
- Modify `package.json`: add `conversation:repair`.
- Modify `docs/homa-planning/build-log.md`: dated founder ruling and billing choice.
- Modify `docs/homa-planning/journeys/10-reconciliation.md`: canonical `material-generation-durable-from-start` ruling.

## Subagent-driven execution protocol

Use this protocol continuously. The user has already chosen execution, so do not pause for an execution-choice question.

- Start in the requested worktree and verify `git rev-parse HEAD` is `a04b6d5b0bbd9aff0c2e9c747fc38d70617c79d4`.
- Read `.superpowers/sdd/progress.md` if it exists. Preserve every existing section. Append this section, or create the file with it when absent:

```text
# Conversation reliability progress
Plan: docs/superpowers/plans/2026-07-15-conversation-reliability-foundation-and-honest-thread.md
Base: a04b6d5
```

- Use the installed skill package:

```sh
SDD_SKILL="/Users/sidneyswift/.cursor/plugins/cache/cursor-public/superpowers/d884ae04edebef577e82ff7c4e143debd0bbec99/skills/subagent-driven-development"
PLAN_FILE="$PWD/docs/superpowers/plans/2026-07-15-conversation-reliability-foundation-and-honest-thread.md"
```

- Before each task, record `BASE="$(git rev-parse HEAD)"`, then run:

```sh
"$SDD_SKILL/scripts/task-brief" "$PLAN_FILE" <task-number>
```

- The implementer reads only the generated task brief plus exact interfaces from completed tasks. The report path is the brief path with `-brief.md` replaced by `-report.md`. The report contains RED command and output, GREEN command and output, changed paths, commit hash, self-review, and concerns.
- One implementer runs at a time. Each implementer uses test-driven development and creates exactly one task commit.
- After the implementer reports DONE, run:

```sh
"$SDD_SKILL/scripts/review-package" "$BASE" HEAD
```

- Give the reviewer the task brief, report, review-package path, and the Global Constraints block. Fix every Critical or Important finding, rerun the focused tests, and re-review.
- After a clean review, append `Task N: complete (commits <base7>..<head7>, review clean)` to `.superpowers/sdd/progress.md`.
- After all tasks, run `review-package` from `git merge-base main HEAD` through `HEAD` and dispatch the broad final review on the most capable available model. Carry every unresolved Minor item from the progress ledger into that review.

---

### Task 1: Keep parented Eve sessions internal and record the ruling

**Files:**

- Create: `apps/web/lib/conversation-continuity/session-lineage.ts`
- Create: `apps/web/lib/conversation-continuity/session-lineage.test.ts`
- Create: `scripts/parented-session-continuity-e2e.mts`
- Modify: `apps/web/agent/hooks/persist-conversation.ts`
- Modify: `apps/web/agent/hooks/continuity-web-delivery.ts`
- Modify: `packages/core/src/events.ts`
- Modify: `packages/core/src/events.test.ts`
- Modify: `docs/homa-planning/build-log.md`
- Modify: `docs/homa-planning/journeys/10-reconciliation.md`

**Interfaces:**

```ts
import type { SessionParent } from "eve/context";

export interface DelegatedSessionLineage {
  childSessionHash: string;
  parentSessionHash: string;
  rootSessionHash: string;
}

export function isParentedEveSession(
  parent: SessionParent | undefined,
): boolean;

export function delegatedSessionLineage(input: {
  childSessionId: string;
  parent: SessionParent;
}): DelegatedSessionLineage;
```

`conversation.session_delegated` has this strict event shape:

```ts
{
  family_id: string;
  child_session_hash: string;
  parent_session_hash: string;
  root_session_hash: string;
}
```

- [ ] **Step 1: Write failing unit and event tests**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  delegatedSessionLineage,
  isParentedEveSession,
} from "./session-lineage";

const parent = {
  callId: "call-1",
  rootSessionId: "root-session",
  sessionId: "parent-session",
  turn: { id: "turn-1", sequence: 0 },
};

describe("delegated Eve session lineage", () => {
  it("treats only a real parent descriptor as delegated", () => {
    assert.equal(isParentedEveSession(undefined), false);
    assert.equal(isParentedEveSession(parent), true);
  });

  it("emits hashes and never raw session identifiers", () => {
    const result = delegatedSessionLineage({
      childSessionId: "child-session",
      parent,
    });
    assert.match(result.childSessionHash, /^[a-f0-9]{64}$/u);
    assert.match(result.parentSessionHash, /^[a-f0-9]{64}$/u);
    assert.match(result.rootSessionHash, /^[a-f0-9]{64}$/u);
    assert.doesNotMatch(JSON.stringify(result), /child-session|parent-session|root-session/u);
  });
});
```

Add strict event tests that accept the four exact properties and reject raw `child_session_id`, `parent_session_id`, `email`, `phone`, and `message`.

- [ ] **Step 2: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/conversation-continuity/session-lineage.test.ts packages/core/src/events.test.ts
```

Expected: FAIL because `session-lineage.ts` and `conversation.session_delegated` do not exist.

- [ ] **Step 3: Implement the guard and PII-free lineage**

```ts
import { createHash } from "node:crypto";

import type { SessionParent } from "eve/context";

function hashSessionId(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isParentedEveSession(
  parent: SessionParent | undefined,
): boolean {
  return parent !== undefined;
}

export function delegatedSessionLineage(input: {
  childSessionId: string;
  parent: SessionParent;
}): DelegatedSessionLineage {
  return {
    childSessionHash: hashSessionId(input.childSessionId),
    parentSessionHash: hashSessionId(input.parent.sessionId),
    rootSessionHash: hashSessionId(input.parent.rootSessionId),
  };
}
```

For `persist-conversation.ts` `message.received`, emit the delegated event and return before canonical resolution when a trusted family exists. Return without emitting when family auth is absent. Do not emit content or raw session IDs:

```ts
const familyId = (
  ctx.session.auth.current?.attributes as
    | { familyId?: string }
    | undefined
)?.familyId;
if (ctx.session.parent && familyId) {
  const lineage = delegatedSessionLineage({
    childSessionId: ctx.session.id,
    parent: ctx.session.parent,
  });
  await emitMapEvent("conversation.session_delegated", {
    family_id: familyId,
    child_session_hash: lineage.childSessionHash,
    parent_session_hash: lineage.parentSessionHash,
    root_session_hash: lineage.rootSessionHash,
  });
  return;
}
if (ctx.session.parent) return;
```

For `persist-conversation.ts` `message.completed` and `continuity-web-delivery.ts` `message.completed`, return before persistence or delivery:

```ts
if (isParentedEveSession(ctx.session.parent)) {
  return;
}
```

Do not change Eve delegation or the parent’s `agent` tool result. The guard affects only Homa persistence and delivery hooks.

- [ ] **Step 4: Add the live local Eve regression**

`scripts/parented-session-continuity-e2e.mts` creates a synthetic family and root web session, asks the root to delegate a fixed marker task, then asserts:

```ts
assert.match(rootAssistantText, /CHILD_RESULT_OK/u);
assert.equal(delegatedEvents.length, 1);
assert.equal(
  familyMessages.filter((row) =>
    delegatedChildHashes.has(hashSessionId(row.session_id)),
  ).length,
  0,
);
assert.equal(
  webDeliveries.filter((row) =>
    delegatedChildHashes.has(hashSessionId(row.session_id)),
  ).length,
  0,
);
```

The script deletes only its synthetic family and auth user in `finally`.

- [ ] **Step 5: Record the dated founder ruling**

Add the newest build-log entry titled:

```text
## 2026-07-15 · Material generation is durable from the start
```

Record these exact decisions:

- Material generation is a durable background job from enqueue.
- Sixty seconds changes only the inline-to-persistent UI presentation.
- An in-flight turn is never migrated or restarted.
- One honest thread is the selected parent UX.
- V1 stages the background lane for materials and uses active-only polling.
- Background execution is not a separate billable capability. Existing model, image, review, render, and material telemetry remains cost truth.
- D7 remains binding.

Add this ruling to the later-ruling register:

```markdown
| `material-generation-durable-from-start` | 2026-07-15 | Material generation becomes a durable background job when it is enqueued. The 60-second threshold changes only the parent presentation from inline work to persistent work and never migrates or restarts an in-flight Eve turn. The selected parent UX is one honest thread. Background execution is a delivery mode for existing material actions, not a separately billable capability, so existing usage telemetry owns cost and no new credit amount is invented. D7 remains binding. | `docs/homa-planning/build-log.md` § Material generation is durable from the start |
```

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --test apps/web/lib/conversation-continuity/session-lineage.test.ts packages/core/src/events.test.ts
pnpm check:events
pnpm check:continuity
```

Expected: PASS. Run the live local E2E when model credentials and a local Eve server are available:

```sh
pnpm exec tsx scripts/parented-session-continuity-e2e.mts --base http://localhost:3233
```

Expected: PASS with a root result, one delegated lineage event, zero delegated family messages, and zero delegated web deliveries.

- [ ] **Step 7: Commit**

```sh
git add apps/web/lib/conversation-continuity/session-lineage.ts apps/web/lib/conversation-continuity/session-lineage.test.ts apps/web/agent/hooks/persist-conversation.ts apps/web/agent/hooks/continuity-web-delivery.ts packages/core/src/events.ts packages/core/src/events.test.ts scripts/parented-session-continuity-e2e.mts docs/homa-planning/build-log.md docs/homa-planning/journeys/10-reconciliation.md
git commit -m "fix: keep delegated sessions out of family history"
```

---

### Task 2: Make terminal assistant output canonical

**Files:**

- Modify: `apps/web/lib/conversation-continuity/ledger.ts`
- Modify: `apps/web/lib/conversation-log.ts`
- Create: `apps/web/lib/conversation-log.test.ts`
- Modify: `scripts/conversation-continuity-e2e.mts`

**Interfaces:**

```ts
export interface ConversationLogDependencies {
  embedText(
    text: string,
    attribution: { familyId: string },
  ): Promise<string | null>;
  persistCanonicalMessage(
    input: PersistCanonicalMessageInput,
  ): Promise<{
    id: string;
    episodeId: string;
    replyClaimed: boolean;
  } | null>;
  updateEmbedding(
    input: {
      familyId: string;
      messageId: string;
      embedding: string;
      replaceExisting: boolean;
    },
  ): Promise<void>;
}

export function persistConversationMessageWithDependencies(
  input: PersistMessageInput,
  dependencies: ConversationLogDependencies,
): Promise<{
  id: string;
  episodeId: string;
  replyClaimed: boolean;
} | null>;

export async function updateConversationMessageEmbedding(input: {
  familyId: string;
  messageId: string;
  embedding: string;
  replaceExisting: boolean;
}): Promise<void>;
```

- [ ] **Step 1: Run the isolation baseline before query changes**

Run:

```sh
pnpm check:isolation
```

Expected: PASS on `a04b6d5`.

- [ ] **Step 2: Write the failing terminal precedence tests**

Add a dependency-level test:

```ts
it("embeds terminal text and replaces the earlier vector", async () => {
  const writes: unknown[] = [];
  await persistConversationMessageWithDependencies(
    {
      attributes: { familyId: FAMILY_ID },
      sessionId: "session-1",
      channelKind: "web",
      sequence: 0,
      role: "assistant",
      content: "The final printable is ready.",
      turnId: "turn-1",
      finishReason: "stop",
    },
    {
      embedText: async (text) => `embedding:${text}`,
      persistCanonicalMessage: async () => ({
        id: MESSAGE_ID,
        episodeId: EPISODE_ID,
        replyClaimed: false,
      }),
      updateEmbedding: async (input) => writes.push(input),
    },
  );
  assert.deepEqual(writes, [{
    familyId: FAMILY_ID,
    messageId: MESSAGE_ID,
    embedding: "embedding:The final printable is ready.",
    replaceExisting: true,
  }]);
});
```

Extend the PostgreSQL E2E with an early assistant row and a terminal collision under the same key. Assert one row, terminal content, terminal timestamp, and `embedding is null` before the new terminal vector is written.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/conversation-log.test.ts
```

Expected: FAIL because the injectable seam and replacement-aware embedding writer do not exist.

- [ ] **Step 4: Implement terminal-aware upsert**

In `persistCanonicalMessage`, change the conflict update to:

```sql
do update set
  content = case
    when ${input.role === "assistant" && input.terminal === true}
      then excluded.content
    else public.conversation_messages.content
  end,
  created_at = case
    when ${input.role === "assistant" && input.terminal === true}
      then excluded.created_at
    else public.conversation_messages.created_at
  end,
  embedding = case
    when ${input.role === "assistant" && input.terminal === true}
      and public.conversation_messages.content is distinct from excluded.content
      then null
    else public.conversation_messages.embedding
  end,
  episode_id = coalesce(
    public.conversation_messages.episode_id,
    excluded.episode_id
  ),
  member_user_id = coalesce(
    public.conversation_messages.member_user_id,
    excluded.member_user_id
  ),
  visibility = case
    when public.conversation_messages.visibility = 'family'
      or excluded.visibility = 'family'
    then 'family'
    else 'internal'
  end,
  task_run_id = coalesce(
    public.conversation_messages.task_run_id,
    excluded.task_run_id
  ),
  provider_message_id = coalesce(
    public.conversation_messages.provider_message_id,
    excluded.provider_message_id
  ),
  thread_key_hash = coalesce(
    public.conversation_messages.thread_key_hash,
    excluded.thread_key_hash
  )
```

Implement the embedding writer:

```ts
export async function updateConversationMessageEmbedding(input: {
  familyId: string;
  messageId: string;
  embedding: string;
  replaceExisting: boolean;
}): Promise<void> {
  const sql = mapDb();
  await sql`
    update public.conversation_messages
    set embedding = ${input.embedding}
    where id = ${input.messageId}
      and family_id = ${input.familyId}
      and (${input.replaceExisting} or embedding is null)
  `;
}
```

`persistConversationMessage` sets `replaceExisting` only for a terminal assistant stop. Nonterminal and user rows retain the old write-once embedding behavior.

- [ ] **Step 5: Run GREEN**

Run:

```sh
pnpm exec tsx --test apps/web/lib/conversation-log.test.ts
pnpm check:continuity
pnpm check:isolation
```

Expected: PASS. In a configured synthetic database, run:

```sh
pnpm continuity:e2e
```

Expected: PASS with one terminal row, terminal time later than progress time, replay unable to restore progress text, and terminal embedding replacement exercised.

- [ ] **Step 6: Commit**

```sh
git add apps/web/lib/conversation-continuity/ledger.ts apps/web/lib/conversation-log.ts apps/web/lib/conversation-log.test.ts scripts/conversation-continuity-e2e.mts
git commit -m "fix: make terminal conversation output canonical"
```

---

### Task 3: Retire superseded progress reply loops

**Files:**

- Modify: `apps/web/lib/child-progress/repository.ts`
- Modify: `apps/web/lib/child-progress/check-in-service.ts`
- Modify: `apps/web/lib/child-progress/postgres-repository.ts`
- Modify: `apps/web/lib/child-progress/check-in-service.test.ts`
- Modify: `scripts/child-progress-postgres-test.mts`
- Create through CLI: additive migration with suffix `_conversation_progress_loop_cleanup.sql`

**Interfaces:**

```ts
export interface CancelProgressReplyLoopsInput {
  familyId: string;
  checkInId: string;
  keepDeliveryId: string | null;
  keepRevision: number | null;
}

cancelProgressReplyLoops(
  input: CancelProgressReplyLoopsInput,
): Promise<number>;
```

- [ ] **Step 1: Run isolation before migration and query work**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing service and PostgreSQL tests**

Add service assertions for all required paths:

```ts
assert.equal(oldRevisionLoop.state, "cancelled");
assert.equal(currentRevisionLoop.state, "open");
assert.equal(pausedLoop.state, "cancelled");
assert.equal(stoppedLoop.state, "cancelled");
assert.equal(completedLoop.state, "cancelled");
```

The reissue case starts an existing active check-in after its current delivery loop is open. The service must increment the revision, clear `currentDeliveryId`, and cancel the prior open loop.

The disposable PostgreSQL test must also update a check-in directly to `pause_reason = 'member_removed'` through the existing membership-removal trigger and assert its matching open loop becomes cancelled.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm check:child-progress
pnpm child-progress:e2e
```

Expected: FAIL because service transitions and the database trigger leave stale progress loops open.

- [ ] **Step 4: Implement transaction-scoped cancellation**

The Postgres adapter uses exact prompt-key structure:

```ts
async cancelProgressReplyLoops(
  input: CancelProgressReplyLoopsInput,
): Promise<number> {
  const exactCurrentPrompt =
    input.keepRevision === null
      ? null
      : `progress-check-in:${input.checkInId}:revision:${input.keepRevision}`;
  const rows = await this.sql<{ id: string }[]>`
    update public.conversation_open_loops loop
    set state = 'cancelled'
    where loop.family_id = ${input.familyId}
      and loop.state = 'open'
      and loop.prompt_key like
        ${`progress-check-in:${input.checkInId}:revision:%`}
      and (
        ${input.keepDeliveryId}::uuid is null
        or loop.delivery_id <> ${input.keepDeliveryId}
        or loop.prompt_key <> ${exactCurrentPrompt}
      )
    returning loop.id
  `;
  return rows.length;
}
```

Add one exhaustive helper in `ProgressCheckInService`:

```ts
private cancelSupersededReplyLoops(
  transaction: ProgressCheckInTransaction,
  checkIn: ProgressCheckInRecord,
): Promise<number> {
  switch (checkIn.state) {
    case "active":
      return transaction.cancelProgressReplyLoops({
        familyId: checkIn.familyId,
        checkInId: checkIn.id,
        keepDeliveryId: checkIn.currentDeliveryId,
        keepRevision:
          checkIn.currentDeliveryId === null
            ? null
            : checkIn.revision,
      });
    case "paused":
    case "completed":
    case "stopped":
      return transaction.cancelProgressReplyLoops({
        familyId: checkIn.familyId,
        checkInId: checkIn.id,
        keepDeliveryId: null,
        keepRevision: null,
      });
    default: {
      const exhaustiveState: never = checkIn.state;
      return exhaustiveState;
    }
  }
}
```

Call it after every successful check-in compare-and-swap, including reissue, response advance/completion, pause, resume, takeover, conflict resolution, delivery pause, and stop. A paused state always clears `currentDeliveryId`.

- [ ] **Step 5: Create the additive trigger migration**

Run:

```sh
supabase migration new conversation_progress_loop_cleanup
```

Store the printed path in:

```sh
PROGRESS_LOOP_MIGRATION="$(ls -t supabase/migrations/*_conversation_progress_loop_cleanup.sql | awk 'NR==1 {print; exit}')"
```

Write this additive function, trigger, and data backfill into that exact file:

```sql
create or replace function private.cancel_stale_progress_reply_loops()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversation_open_loops loop
  set state = 'cancelled'
  where loop.family_id = new.family_id
    and loop.state = 'open'
    and loop.prompt_key like
      'progress-check-in:' || new.id::text || ':revision:%'
    and (
      new.state <> 'active'
      or new.current_delivery_id is null
      or loop.delivery_id <> new.current_delivery_id
      or loop.prompt_key <>
        'progress-check-in:' || new.id::text ||
        ':revision:' || new.revision::text
    );
  return new;
end
$$;

revoke all on function private.cancel_stale_progress_reply_loops()
  from public, anon, authenticated;

drop trigger if exists progress_check_ins_cancel_stale_reply_loops
  on public.progress_check_ins;
create trigger progress_check_ins_cancel_stale_reply_loops
after update of state, revision, current_delivery_id
on public.progress_check_ins
for each row execute function
  private.cancel_stale_progress_reply_loops();

update public.conversation_open_loops loop
set state = 'cancelled'
from public.progress_check_ins check_in
where loop.family_id = check_in.family_id
  and loop.state = 'open'
  and loop.prompt_key like
    'progress-check-in:' || check_in.id::text || ':revision:%'
  and (
    check_in.state <> 'active'
    or check_in.current_delivery_id is null
    or loop.delivery_id <> check_in.current_delivery_id
    or loop.prompt_key <>
      'progress-check-in:' || check_in.id::text ||
      ':revision:' || check_in.revision::text
  );
```

This backfill changes only open-loop metadata. It does not change progress state, evidence, responses, scores, or a real family’s answers.

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm check:child-progress
pnpm child-progress:e2e
pnpm check:continuity
pnpm check:isolation
```

Expected: PASS. Reissue keeps only the newest delivered revision open. Pause, stop, complete, conflict pause, delivery pause, and member removal leave no matching open loop.

- [ ] **Step 7: Commit**

```sh
git add apps/web/lib/child-progress/repository.ts apps/web/lib/child-progress/check-in-service.ts apps/web/lib/child-progress/postgres-repository.ts apps/web/lib/child-progress/check-in-service.test.ts scripts/child-progress-postgres-test.mts "$PROGRESS_LOOP_MIGRATION"
git commit -m "fix: retire stale progress reply loops"
```

---

### Task 4: Show one current material revision

**Files:**

- Create: `apps/web/lib/materials/parent-visible.ts`
- Create: `apps/web/lib/materials/parent-visible.test.ts`
- Create: `apps/web/app/app/material-message-parts.ts`
- Create: `apps/web/app/app/material-message-parts.test.ts`
- Modify: `apps/web/agent/tools/create_printable.ts`
- Modify: `apps/web/lib/chat-history.ts`
- Modify: `apps/web/lib/chat-history-model.ts`
- Modify: `apps/web/lib/chat-history-model.test.ts`
- Modify: `apps/web/app/app/message-parts.tsx`

**Interfaces:**

```ts
export interface MaterialRevisionCandidate {
  id: string;
  revisesId: string | null;
  status: "draft" | "final" | "superseded";
  reviewPass: boolean | null;
  order: number;
}

export function selectParentVisibleMaterialRevisions<
  T extends MaterialRevisionCandidate,
>(candidates: readonly T[]): T[];
```

- [ ] **Step 1: Run isolation before changing history queries**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing chain and live-output tests**

```ts
it("selects one latest passing row and hides a later failed attempt", () => {
  const selected = selectParentVisibleMaterialRevisions([
    revision("v1", null, "draft", false, 1),
    revision("v2", "v1", "draft", true, 2),
    revision("v3", "v2", "draft", false, 3),
  ]);
  assert.deepEqual(selected.map((row) => row.id), ["v2"]);
});

it("prefers the final even when another failed row is newer", () => {
  const selected = selectParentVisibleMaterialRevisions([
    revision("v1", null, "final", true, 1),
    revision("v2", "v1", "draft", false, 2),
  ]);
  assert.deepEqual(selected.map((row) => row.id), ["v1"]);
});
```

The live-parts test creates two independent chains and one failed revision. It expects one card per chain and no card for the failed row.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/materials/parent-visible.test.ts apps/web/app/app/material-message-parts.test.ts apps/web/lib/chat-history-model.test.ts
```

Expected: FAIL because the selector does not exist and history still reconstructs every row as ready.

- [ ] **Step 4: Implement the chain selector**

Use a bounded parent walk to identify connected roots, then choose one row:

```ts
function rootIdFor(
  candidate: MaterialRevisionCandidate,
  byId: ReadonlyMap<string, MaterialRevisionCandidate>,
): string {
  let current = candidate;
  const visited = new Set<string>();
  while (current.revisesId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = byId.get(current.revisesId);
    if (!parent) return current.revisesId;
    current = parent;
  }
  return current.id;
}

function newest<T extends MaterialRevisionCandidate>(
  rows: readonly T[],
): T {
  return [...rows].sort(
    (left, right) =>
      right.order - left.order ||
      right.id.localeCompare(left.id),
  )[0];
}
```

For each root, select the newest final when present. Otherwise select the newest row with `status !== "superseded"` and `reviewPass !== false`. Omit a chain with no selectable row. Sort selected rows by `order`.

- [ ] **Step 5: Carry lineage through live and archived shapes**

`create_printable` adds these fields to its existing material result:

```ts
{
  id: materialId,
  title: input.title,
  kind,
  skill: input.skill ?? null,
  childName: input.childName ?? null,
  previewUrl,
  pdfUrl,
  status: "draft",
  revisesId: input.revisesId ?? null,
  reviewPassed: review === null ? null : review.pass,
}
```

Extend `MATERIAL_COLUMNS` with:

```text
status, revises, review_pass:generation->review->>pass
```

Map `"true"` to `true`, `"false"` to `false`, and null to null. Run the shared selector before returning `materials`.

`material-message-parts.ts` parses only output-available `create_printable`, `show_material`, and legacy `create_worksheet` parts, then runs the same selector. `message-parts.tsx` renders its selected artifacts in original part order.

Do not alter `apps/web/lib/admin/chats-data.ts` or `getFamilyMaterialsDeep`. Founder admin continues to receive every attempt and review issue.

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/materials/parent-visible.test.ts apps/web/app/app/material-message-parts.test.ts apps/web/lib/chat-history-model.test.ts
pnpm check:chat-ui
pnpm check:isolation
```

Expected: PASS. Live and reload views each show one current passing or final card per chain, while founder data remains complete.

- [ ] **Step 7: Commit**

```sh
git add apps/web/lib/materials/parent-visible.ts apps/web/lib/materials/parent-visible.test.ts apps/web/app/app/material-message-parts.ts apps/web/app/app/material-message-parts.test.ts apps/web/agent/tools/create_printable.ts apps/web/lib/chat-history.ts apps/web/lib/chat-history-model.ts apps/web/lib/chat-history-model.test.ts apps/web/app/app/message-parts.tsx
git commit -m "fix: show one current material revision"
```

---

### Task 5: Gate the four-block brief before transport

**Files:**

- Create: `apps/web/lib/tasks/output-gate.ts`
- Create: `apps/web/lib/tasks/output-gate.test.ts`
- Modify: `apps/web/lib/tasks/research-brief-format.ts`
- Modify: `apps/web/lib/tasks/research-brief-format.test.ts`
- Modify: `apps/web/lib/conversation-continuity/task-delivery.ts`
- Modify: `apps/web/lib/conversation-continuity/task-delivery.test.ts`
- Modify: `apps/web/agent/channels/dispatch.ts`
- Modify: `apps/web/agent/skills/research-brief/SKILL.md`

**Interfaces:**

```ts
export const RESEARCH_BRIEF_MAX_CHARS = 600;

export type TaskOutputGateResult =
  | { ok: true }
  | {
      ok: false;
      code: "research_brief_format";
      errors: string[];
    };

export function validateTaskOutputForDelivery(
  kind: FamilyTaskKind,
  text: string,
): TaskOutputGateResult;
```

- [ ] **Step 1: Write failing 600-character and no-fallback tests**

Add exact boundary tests: a valid 600-character brief passes and the same brief at 601 characters fails with `length`.

Add this delivery test:

```ts
it("does not attempt SMS or email for an invalid morning brief", async () => {
  let smsCalls = 0;
  let emailCalls = 0;
  const result = await deliverTaskMessage(
    {
      ...input(),
      text: validBriefLongerThan600,
      recipients: [recipients[0]],
    },
    {
      ledger: new FakeLedger(),
      transports: {
        async sendSms() {
          smsCalls += 1;
          return true;
        },
        async sendEmail() {
          emailCalls += 1;
          return true;
        },
      },
    },
  );
  assert.equal(result.status, "failed");
  assert.equal(smsCalls, 0);
  assert.equal(emailCalls, 0);
});
```

- [ ] **Step 2: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/tasks/research-brief-format.test.ts apps/web/lib/tasks/output-gate.test.ts apps/web/lib/conversation-continuity/task-delivery.test.ts
```

Expected: FAIL because the validator still allows the carrier ceiling and transport still falls back.

- [ ] **Step 3: Implement one aligned gate**

In `research-brief-format.ts`:

```ts
export const RESEARCH_BRIEF_MAX_CHARS = 600;

if (
  Array.from(text).length > RESEARCH_BRIEF_MAX_CHARS ||
  !fitsInOneSms(text)
) {
  errors.push("length");
}
```

Implement the exhaustive task-kind gate:

```ts
export function validateTaskOutputForDelivery(
  kind: FamilyTaskKind,
  text: string,
): TaskOutputGateResult {
  switch (kind) {
    case "morning_brief": {
      const result = validateResearchBriefFormat(text);
      return result.ok
        ? { ok: true }
        : {
            ok: false,
            code: "research_brief_format",
            errors: result.errors,
          };
    }
    case "journal_prompt":
    case "custom":
      return { ok: true };
    default: {
      const exhaustiveKind: never = kind;
      return exhaustiveKind;
    }
  }
}
```

`deliverTaskMessage` returns a failed aggregate before opening a delivery attempt when this gate fails.

In the dispatch channel, invoke the same gate immediately after terminal text is trimmed and before `persistCanonicalMessage`. On failure, call `finishTaskRun` with:

```ts
{
  familyId,
  kind,
  status: "failed",
  sessionId: ctx.session.id,
  error: `output_gate:${gate.code}:${gate.errors.join(",")}`.slice(0, 500),
}
```

Then return. There is no SMS attempt and no email fallback.

Keep the four required blocks and microscope headline in the skill. Replace its old 670-character explanation with the exact 600-character runtime contract.

- [ ] **Step 4: Run GREEN**

Run:

```sh
pnpm check:research-brief
pnpm exec tsx --test apps/web/lib/tasks/output-gate.test.ts apps/web/lib/conversation-continuity/task-delivery.test.ts
pnpm check:fleet-skills
```

Expected: PASS at 600, fail at 601, and zero transport calls for invalid output.

When Gateway credentials are available:

```sh
pnpm eval:research-brief
```

Expected: PASS against the unchanged four-block craft contract.

- [ ] **Step 5: Commit**

```sh
git add apps/web/lib/tasks/output-gate.ts apps/web/lib/tasks/output-gate.test.ts apps/web/lib/tasks/research-brief-format.ts apps/web/lib/tasks/research-brief-format.test.ts apps/web/lib/conversation-continuity/task-delivery.ts apps/web/lib/conversation-continuity/task-delivery.test.ts apps/web/agent/channels/dispatch.ts apps/web/agent/skills/research-brief/SKILL.md
git commit -m "fix: gate research briefs before delivery"
```

---

### Task 6: Foreground the exact reply target

**Files:**

- Modify: `apps/web/lib/conversation-continuity/reply-policy.ts`
- Modify: `apps/web/lib/conversation-continuity/reply-policy.test.ts`
- Modify: `apps/web/lib/conversation-continuity/continuity-service.ts`
- Modify: `apps/web/lib/conversation-continuity/continuity-service.test.ts`
- Modify: `scripts/conversation-continuity-model-eval.mts`

**Interfaces:**

```ts
export function renderExactReplyTarget(
  candidate: Pick<
    PendingDeliveryCandidate,
    "messageContent" | "promptKey"
  >,
): string;
```

- [ ] **Step 1: Write failing ordering and competing-topic tests**

```ts
const exact = renderExactReplyTarget({
  messageContent: "Want me to make Story a stop-and-go game?",
  promptKey: "morning-brief-offer",
});
assert.match(
  exact,
  new RegExp(JSON.stringify(
    "Want me to make Story a stop-and-go game?",
  )),
);

const resolved = await resolveInboundTurn(repository, input);
assert.ok(
  resolved.contextMarkdown.indexOf("## Exact reply target") <
    resolved.contextMarkdown.indexOf(
      "## Recent conversation continuity",
    ),
);
```

The repository fixture includes a newer unrelated ocean worksheet topic in generic history. The exact matched target remains the stop-and-go offer.

- [ ] **Step 2: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/conversation-continuity/reply-policy.test.ts apps/web/lib/conversation-continuity/continuity-service.test.ts
```

Expected: FAIL because matched targets are still mixed into generic history.

- [ ] **Step 3: Implement compact JSON-quoted target rendering**

```ts
const EXACT_REPLY_TARGET_MAX_CHARS = 1200;

export function renderExactReplyTarget(
  candidate: Pick<
    PendingDeliveryCandidate,
    "messageContent" | "promptKey"
  >,
): string {
  const content = candidate.messageContent?.trim();
  if (!content) return "";
  return [
    "## Exact reply target",
    "",
    "The current parent message was deterministically matched to this prior Homa delivery. Answer this target before using generic history.",
    "",
    JSON.stringify(
      content.slice(0, EXACT_REPLY_TARGET_MAX_CHARS),
    ),
  ].join("\n");
}
```

For a matched reply, `resolveInboundTurn` builds:

```ts
contextMarkdown = [
  renderExactReplyTarget(reply.candidate),
  renderContinuityContext(messages),
]
  .filter((block) => block.length > 0)
  .join("\n\n");
```

Ambiguous behavior is unchanged.

- [ ] **Step 4: Strengthen the behavioral eval**

The eval system contains the exact target first, then generic history with a newer unrelated worksheet request. Prompt is `Yes`. Pass only when the model answers the game offer, avoids the worksheet topic, and does not ask “yes to what”.

- [ ] **Step 5: Run GREEN**

Run:

```sh
pnpm check:continuity
pnpm eval:continuity
```

Expected: deterministic tests PASS. With Gateway credentials, the behavioral eval PASS output references the stop-and-go game and not the competing worksheet.

- [ ] **Step 6: Commit**

```sh
git add apps/web/lib/conversation-continuity/reply-policy.ts apps/web/lib/conversation-continuity/reply-policy.test.ts apps/web/lib/conversation-continuity/continuity-service.ts apps/web/lib/conversation-continuity/continuity-service.test.ts scripts/conversation-continuity-model-eval.mts
git commit -m "fix: foreground exact reply targets"
```

---

### Task 7: Add the PII-minimized conversation health audit

**Files:**

- Create: `scripts/conversation-health-audit-lib.ts`
- Create: `scripts/conversation-health-audit.test.ts`
- Create: `scripts/conversation-health-audit.mts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

```ts
export type ConversationHealthFindingCode =
  | "delegated_family_visible"
  | "stale_progress_loop"
  | "semantic_refusal"
  | "terminal_delivery_lag"
  | "material_burst"
  | "material_review_failure"
  | "research_brief_gate_failure"
  | "delivery_fallback";

export interface ConversationHealthEvidence {
  fingerprint: string;
  chars: number;
  rule: string;
}

export interface ConversationHealthFinding {
  code: ConversationHealthFindingCode;
  severity: "critical" | "warning";
  occurredAt: string;
  familyHash: string;
  subjectHash: string;
  metadata: Record<
    string,
    string | number | boolean | null
  >;
  evidence: ConversationHealthEvidence;
}

export function analyzeConversationHealth(
  input: ConversationHealthAuditInput,
  now: Date,
): ConversationHealthFinding[];
```

**Fixed thresholds:**

```ts
export const TERMINAL_DELIVERY_WARNING_MS = 2 * 60_000;
export const MISSING_DELIVERY_GRACE_MS = 15 * 60_000;
export const MATERIAL_BURST_COUNT = 4;
export const MATERIAL_BURST_WINDOW_MS = 10 * 60_000;
export const DEFAULT_AUDIT_WINDOW_HOURS = 24;
export const MAX_AUDIT_WINDOW_HOURS = 168;
```

- [ ] **Step 1: Run isolation before adding operational queries**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write one failing July 15 fixture**

The fixture includes:

- a `conversation.session_delegated` child hash with a family-visible child row and web delivery,
- an old progress loop whose revision is lower than its active check-in,
- a paused check-in with an open loop,
- a family-visible assistant refusal matching `claimed_inability`,
- a terminal row delivered after two minutes and another missing after fifteen,
- four materials in one session and turn inside ten minutes,
- one `generation.review.pass = false`,
- a morning-brief run whose summary fails the 600-character gate,
- one failed SMS delivery followed by sent email for the same message.

Assert the exact ordered codes:

```ts
assert.deepEqual(
  analyzeConversationHealth(fixture, NOW).map(
    (finding) => finding.code,
  ),
  [
    "delegated_family_visible",
    "stale_progress_loop",
    "stale_progress_loop",
    "semantic_refusal",
    "terminal_delivery_lag",
    "terminal_delivery_lag",
    "material_burst",
    "material_review_failure",
    "research_brief_gate_failure",
    "delivery_fallback",
  ],
);
```

Assert serialized output contains no raw family UUID, session ID, names, email, phone, URL, message, material title, review issue, or brief body.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --test scripts/conversation-health-audit.test.ts
```

Expected: FAIL because the audit library does not exist.

- [ ] **Step 4: Implement bounded evidence**

Never emit raw text. Evidence is:

```ts
function evidenceFor(
  text: string,
  rule: string,
): ConversationHealthEvidence {
  return {
    fingerprint: createHash("sha256")
      .update(text)
      .digest("hex")
      .slice(0, 16),
    chars: Array.from(text).length,
    rule,
  };
}
```

Identifiers use a separate 12-character SHA-256 display hash. Metadata contains only status, channel, revision, counts, durations, validator error names, and classified provider error names.

Semantic refusal rules are review candidates, not automatic product judgments:

```ts
const SEMANTIC_REFUSAL_RULES = [
  {
    code: "claimed_inability",
    pattern:
      /\b(?:i|homa)\s+(?:can(?:not|'t)|could(?:not|n't)|am unable to)\b.{0,100}\b(?:make|create|send|show|remember|access|find|open)\b/iu,
  },
] as const;
```

Stale progress detection parses only:

```ts
/^progress-check-in:([^:]+):revision:(\d+)$/u
```

and flags an open loop when its check-in is not active, its delivery differs from `current_delivery_id`, or its revision differs from the current revision.

The audit queries only bounded metadata columns from `events`, `conversation_messages`, `conversation_deliveries`, `conversation_open_loops`, `progress_check_ins`, `agent_tool_calls`, `materials`, and `homa_task_runs`. It does not select family names, member names, emails, phone numbers, child names, full tool args, or full tool results.

- [ ] **Step 5: Implement the operational command**

`scripts/conversation-health-audit.mts`:

- requires `HOMA_CONVERSATION_DATABASE_URL`,
- does not load `.env.local`,
- accepts `--since-hours N` and `--json`,
- rejects unknown arguments,
- defaults to 24 hours and caps at 168,
- closes the database in `finally`,
- exits 1 when any finding exists and 0 when clean.

Add:

```json
"conversation:health": "tsx scripts/conversation-health-audit.mts"
```

and include `scripts/conversation-health-audit.test.ts` in `check:continuity`.

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --test scripts/conversation-health-audit.test.ts
pnpm check:continuity
pnpm check:isolation
```

Expected: PASS. Against an explicitly supplied database:

```sh
HOMA_CONVERSATION_DATABASE_URL="postgres://..." pnpm conversation:health -- --since-hours 24 --json
```

Expected: JSON contains only hashes, bounded evidence descriptors, status metadata, and counts. Exit 1 means findings were flagged, not that the script crashed.

- [ ] **Step 7: Commit**

```sh
git add scripts/conversation-health-audit-lib.ts scripts/conversation-health-audit.test.ts scripts/conversation-health-audit.mts package.json README.md
git commit -m "feat: audit conversation health"
```

---

### Task 8: Add the durable material job schema, flags, and events

**Files:**

- Create through CLI: additive migration with suffix `_material_background_jobs.sql`
- Create: `apps/web/lib/material-jobs/types.ts`
- Create: `apps/web/lib/material-jobs/flag.ts`
- Create: `apps/web/lib/material-jobs/migration-contract.test.ts`
- Modify: `packages/core/src/events.ts`
- Modify: `packages/core/src/events.test.ts`
- Modify: `apps/web/.env.example`

**Interfaces:**

```ts
export type MaterialJobOriginChannel = "web" | "sms";

export interface MaterialJobRecord {
  id: string;
  familyId: string;
  recipientMemberUserId: string | null;
  episodeId: string;
  requestMessageId: string;
  requestSessionId: string;
  originChannel: MaterialJobOriginChannel;
  destinationHash: string | null;
  requestTitle: string;
  requestText: string;
  childId: string | null;
  revisesMaterialId: string | null;
  status: MaterialJobStatus;
  deliveryStatus: MaterialJobDeliveryStatus;
  runtimeSessionId: string | null;
  resultMessageId: string | null;
  resultMaterialId: string | null;
  resultDeliveryId: string | null;
  attemptCount: number;
  errorCode: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
}
```

Flags:

```ts
export function materialBackgroundExecutionEnabled(): boolean {
  return process.env.HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED === "true";
}

export function materialJobPollingEnabled(): boolean {
  return process.env.HOMA_BACKGROUND_MATERIAL_POLLING_ENABLED === "true";
}
```

- [ ] **Step 1: Run isolation before schema work**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing migration, flag, and event tests**

The migration contract test finds exactly one migration with the required suffix and asserts it contains the table, strict status checks, unique origin-message key, family-child/material composite checks, RLS, per-recipient select policy, and no authenticated write policy.

Event tests require these exact strict schemas:

```ts
"materials.job_queued": {
  family_id: FAMILY_ID,
  origin_channel: "web",
  revision: false,
},
"materials.job_started": {
  family_id: FAMILY_ID,
  origin_channel: "web",
  queue_ms: 1200,
},
"materials.job_finished": {
  family_id: FAMILY_ID,
  origin_channel: "web",
  outcome: "completed",
  delivery: "sent",
  duration_ms: 45000,
},
```

Reject names, request text, title, email, phone, URL, job ID, message ID, and material ID.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/material-jobs/migration-contract.test.ts packages/core/src/events.test.ts
```

Expected: FAIL because the migration, types, flags, and lifecycle events do not exist.

- [ ] **Step 4: Create the migration with the Supabase CLI**

Run:

```sh
supabase migration new material_background_jobs
```

Capture the exact printed file:

```sh
MATERIAL_JOBS_MIGRATION="$(ls -t supabase/migrations/*_material_background_jobs.sql | awk 'NR==1 {print; exit}')"
```

Write:

```sql
create table public.material_background_jobs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families (id) on delete cascade,
  recipient_member_user_id uuid
    references auth.users (id) on delete set null,
  episode_id uuid not null,
  request_message_id uuid not null,
  request_session_id text not null
    check (btrim(request_session_id) <> ''),
  origin_channel text not null
    check (origin_channel in ('web', 'sms')),
  destination_hash text
    check (
      destination_hash is null
      or destination_hash ~ '^[a-f0-9]{64}$'
    ),
  request_title text not null
    check (
      char_length(btrim(request_title)) between 3 and 90
    ),
  request_text text not null
    check (
      char_length(btrim(request_text)) between 10 and 4000
    ),
  child_id uuid,
  revises_material_id uuid,
  status text not null default 'queued'
    check (
      status in ('queued', 'running', 'completed', 'failed')
    ),
  delivery_status text not null default 'pending'
    check (
      delivery_status in ('pending', 'sent', 'failed')
    ),
  runtime_session_id text,
  result_message_id uuid,
  result_material_id uuid,
  result_delivery_id uuid,
  attempt_count integer not null default 0
    check (attempt_count between 0 and 1),
  error_code text
    check (
      error_code is null
      or char_length(error_code) <= 120
    ),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (family_id, request_message_id),
  foreign key (episode_id, family_id)
    references public.conversation_episodes (id, family_id)
    on delete cascade,
  foreign key (request_message_id, family_id)
    references public.conversation_messages (id, family_id)
    on delete cascade,
  foreign key (child_id, family_id)
    references public.children (id, family_id)
    on delete set null (child_id),
  foreign key (revises_material_id, family_id)
    references public.materials (id, family_id)
    on delete set null (revises_material_id),
  foreign key (result_message_id, family_id)
    references public.conversation_messages (id, family_id)
    on delete no action,
  foreign key (result_material_id, family_id)
    references public.materials (id, family_id)
    on delete no action,
  foreign key (result_delivery_id, family_id)
    references public.conversation_deliveries (id, family_id)
    on delete no action,
  check (
    (origin_channel = 'web'
      and recipient_member_user_id is not null
      and destination_hash is null)
    or
    (origin_channel = 'sms'
      and destination_hash is not null)
  ),
  check (
    (status = 'queued'
      and started_at is null
      and finished_at is null
      and runtime_session_id is null
      and attempt_count = 0)
    or
    (status = 'running'
      and started_at is not null
      and finished_at is null
      and attempt_count = 1)
    or
    (status = 'completed'
      and started_at is not null
      and finished_at is not null
      and result_message_id is not null
      and result_material_id is not null
      and result_delivery_id is not null
      and attempt_count = 1)
    or
    (status = 'failed'
      and finished_at is not null
      and error_code is not null
      and attempt_count = 1)
  )
);

create index material_background_jobs_active_idx
  on public.material_background_jobs
    (status, created_at)
  where status in ('queued', 'running');

create index material_background_jobs_recipient_idx
  on public.material_background_jobs
    (recipient_member_user_id, created_at desc)
  where recipient_member_user_id is not null;

alter table public.material_background_jobs
  enable row level security;

create policy "members read their own material jobs"
  on public.material_background_jobs
  for select
  to authenticated
  using (
    recipient_member_user_id = auth.uid()
    and public.is_family_member(family_id)
  );

revoke insert, update, delete
  on public.material_background_jobs
  from anon, authenticated;
```

If a referenced table lacks the `(id, family_id)` unique key, add a unique index for that existing pair in this same additive migration before the foreign key. Do not weaken to an unscoped foreign key.

- [ ] **Step 5: Register lifecycle events and dark flags**

Add strict Zod schemas for `materials.job_queued`, `materials.job_started`, and `materials.job_finished`. `outcome` is `completed | failed`; `delivery` is `sent | failed | not_attempted`.

Add unset variables to `apps/web/.env.example`:

```text
HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED=
HOMA_BACKGROUND_MATERIAL_POLLING_ENABLED=
```

Do not edit or create an action-cost registry.

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --test apps/web/lib/material-jobs/migration-contract.test.ts packages/core/src/events.test.ts
pnpm check:events
pnpm check:isolation
```

Expected: PASS. Both flags are false for unset, `"1"`, and `"TRUE"`, and true only for exact `"true"`.

- [ ] **Step 7: Commit**

```sh
git add "$MATERIAL_JOBS_MIGRATION" apps/web/lib/material-jobs/types.ts apps/web/lib/material-jobs/flag.ts apps/web/lib/material-jobs/migration-contract.test.ts packages/core/src/events.ts packages/core/src/events.test.ts apps/web/.env.example
git commit -m "feat: add durable material job schema"
```

---

### Task 9: Implement the material job lifecycle store

**Files:**

- Create: `apps/web/lib/material-jobs/store.ts`
- Create: `apps/web/lib/material-jobs/store.test.ts`
- Create: `scripts/material-jobs-postgres-test.mts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

```ts
export interface EnqueueMaterialJobInput {
  familyId: string;
  recipientMemberUserId: string | null;
  episodeId: string;
  requestMessageId: string;
  requestSessionId: string;
  originChannel: "web" | "sms";
  destinationHash: string | null;
  requestTitle: string;
  requestText: string;
  childId: string | null;
  revisesMaterialId: string | null;
  now: Date;
}

export type EnqueueMaterialJobResult =
  | { kind: "queued"; job: MaterialJobRecord }
  | { kind: "existing"; job: MaterialJobRecord }
  | { kind: "invalid_scope" };

export function enqueueMaterialJob(
  input: EnqueueMaterialJobInput,
): Promise<EnqueueMaterialJobResult>;

export function claimQueuedMaterialJobs(input: {
  now: Date;
  limit: number;
}): Promise<MaterialJobRecord[]>;

export function setMaterialJobRuntimeSession(input: {
  jobId: string;
  familyId: string;
  sessionId: string;
}): Promise<boolean>;

export function finishMaterialJob(input:
  | {
      outcome: "completed";
      jobId: string;
      familyId: string;
      runtimeSessionId: string;
      resultMessageId: string;
      resultMaterialId: string;
      resultDeliveryId: string;
      deliveryStatus: "sent" | "failed";
      finishedAt: Date;
    }
  | {
      outcome: "failed";
      jobId: string;
      familyId: string;
      runtimeSessionId: string | null;
      errorCode: string;
      finishedAt: Date;
    }
): Promise<boolean>;

export function reapStaleMaterialJobs(input: {
  now: Date;
  staleAfterMs: number;
}): Promise<number>;
```

- [ ] **Step 1: Run isolation before store queries**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing service and disposable Postgres tests**

Cover:

- exact enqueue returns `queued`,
- same family and request message returns `existing`,
- foreign child and foreign revision return `invalid_scope`,
- two concurrent claimers return the job once,
- claim increments attempt to one and never requeues,
- runtime session can be set once,
- terminal completion requires the same family and running job,
- stale running becomes failed and cannot be claimed again,
- the recipient policy reads only the signed-in adult’s rows.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/material-jobs/store.test.ts
pnpm exec tsx scripts/material-jobs-postgres-test.mts
```

Expected: FAIL because the lifecycle store does not exist.

- [ ] **Step 4: Implement exact family re-scoping and claim-once SQL**

Enqueue runs in one transaction. It verifies:

```sql
select message.id
from public.conversation_messages message
where message.id = $request_message_id
  and message.family_id = $family_id
  and message.session_id = $request_session_id
```

It separately verifies episode, recipient membership when non-null, child when non-null, and revises material when non-null. Only then insert. The unique origin-message key gives one work object per parent request. A separate later request may create its own work object without mutating or restarting the first job.

Claim uses `for update skip locked`:

```sql
with claimed as (
  select id
  from public.material_background_jobs
  where status = 'queued'
  order by created_at
  limit $limit
  for update skip locked
)
update public.material_background_jobs job
set status = 'running',
    attempt_count = 1,
    started_at = $now,
    updated_at = $now
from claimed
where job.id = claimed.id
returning job.*
```

No code path changes `running` back to `queued`. The stale reaper sets:

```text
status=failed
delivery_status=failed
error_code=stale_running_job
finished_at=now
```

and emits no synthetic success.

- [ ] **Step 5: Build the focused PostgreSQL E2E**

`scripts/material-jobs-postgres-test.mts` follows the existing disposable-cluster pattern:

- discovers Homebrew Postgres or `HOMA_POSTGRES_BIN`,
- creates a temporary cluster and database,
- creates minimal auth, family, member, child, episode, message, material, and delivery prerequisites,
- applies the generated material-jobs migration,
- runs lifecycle and RLS assertions,
- stops and removes the cluster in `finally`.

Add:

```json
"material-jobs:e2e": "tsx scripts/material-jobs-postgres-test.mts"
```

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --test apps/web/lib/material-jobs/store.test.ts
pnpm material-jobs:e2e
pnpm check:isolation
```

Expected: PASS with one claim, one completion, cross-family refusals, per-adult RLS, and no restart after stale failure.

- [ ] **Step 7: Commit**

```sh
git add apps/web/lib/material-jobs/store.ts apps/web/lib/material-jobs/store.test.ts scripts/material-jobs-postgres-test.mts package.json README.md
git commit -m "feat: add material job lifecycle store"
```

---

### Task 10: Enqueue material builds from the root studio

**Files:**

- Create: `apps/web/agent/tools/enqueue_material_job.ts`
- Create: `apps/web/lib/material-jobs/enqueue-policy.ts`
- Create: `apps/web/lib/material-jobs/enqueue-policy.test.ts`
- Create: `scripts/material-job-routing-eval.mts`
- Modify: `apps/web/agent/skills/materials-studio/SKILL.md`
- Modify: `apps/web/agent/instructions/sms-mode.ts`
- Modify: `package.json`

**Tool input:**

```ts
const enqueueMaterialJobInput = z.object({
  title: z.string().trim().min(3).max(90),
  brief: z.string().trim().min(10).max(4000),
  childId: z.uuid().optional(),
  revisesId: z.uuid().optional(),
});
```

The model never supplies family, member, episode, request message, session, channel, or destination.

- [ ] **Step 1: Write failing policy and tool-contract tests**

Cover:

- exact flag `"true"` allows a normal web or linked SMS root,
- missing canonical message, episode, or web member refuses,
- SMS requires a trusted phone number,
- `channel = dispatch`, `backgroundJobId`, or any parented session refuses,
- child and revises IDs flow only to the family-scoped store,
- a repeated tool call for one request returns the existing job,
- enqueue result contains no phone number or family ID.

- [ ] **Step 2: Run RED**

Run:

```sh
pnpm exec tsx --test apps/web/lib/material-jobs/enqueue-policy.test.ts
```

Expected: FAIL because the policy and tool do not exist.

- [ ] **Step 3: Implement the smallest deterministic enqueue primitive**

Trusted attributes:

```ts
interface MaterialJobAuthAttributes {
  backgroundJobId?: string;
  canonicalInboundMessageId?: string;
  channel?: string;
  episodeId?: string;
  familyId?: string;
  memberUserId?: string;
  phoneNumber?: string;
}
```

The policy returns:

```ts
export type MaterialJobEnqueueIdentity =
  | {
      ok: true;
      familyId: string;
      memberUserId: string | null;
      episodeId: string;
      requestMessageId: string;
      originChannel: "web" | "sms";
      destinationHash: string | null;
    }
  | {
      ok: false;
      reason:
        | "disabled"
        | "background_session"
        | "unsupported_channel"
        | "missing_identity";
    };
```

The tool:

1. Resolves family access from auth.
2. Derives web or SMS origin.
3. Hashes SMS destination with `hashContinuityKey`.
4. Calls `enqueueMaterialJob`.
5. Emits `materials.job_queued` only for a new row.
6. Returns:

```ts
{
  queued: true,
  existing: result.kind === "existing",
  job: {
    id: result.job.id,
    status: result.job.status,
    deliveryStatus: result.job.deliveryStatus,
    title: result.job.requestTitle,
    createdAt: result.job.createdAt,
  },
  note:
    "The material job is durable. End this turn after one short acknowledgement. Do not call material generation tools in this root session.",
}
```

If disabled, return `queued: false, fallbackInline: true`. This is the code-first compatibility path before migration and flags.

- [ ] **Step 4: Update the materials-studio procedure**

Add an execution-lane section before creation-path selection:

1. In a normal interactive web or linked SMS session, after any necessary calibration, call `enqueue_material_job` before `generate_image` or `create_printable`.
2. When it returns `queued: true`, end quickly after one short acknowledgement. Do not continue the build in the root session.
3. When it returns `fallbackInline: true`, retain the current inline workflow.
4. When current instructions identify a material background job, never enqueue. Load this skill and run the existing design, image, render, review, revision, and delivery workflow.
5. `show_material` and `mark_material_final` remain inline.

Update SMS guidance so a successful enqueue is the first action and the normal reply is the acknowledgement. Do not also call `send_heads_up`. Flag-off inline builds retain the existing progress-text rule.

- [ ] **Step 5: Add positive and adversarial-negative behavioral fixtures**

`scripts/material-job-routing-eval.mts` loads the real materials-studio skill and asks the model for one exact label:

```ts
const cases = [
  {
    mode: "root",
    request: "Make Nora an ocean letter-tracing page.",
    expected: "enqueue",
  },
  {
    mode: "root",
    request: "Show me the ocean page you already made.",
    expected: "show_existing",
  },
  {
    mode: "root",
    request: "Nora can already write N. What should we practice next?",
    expected: "calibrate_or_answer",
  },
  {
    mode: "background",
    request: "Make Nora an ocean letter-tracing page.",
    expected: "build_inline_here",
  },
] as const;
```

This eval has no real tools and performs no writes.

Add:

```json
"eval:material-jobs": "tsx scripts/material-job-routing-eval.mts"
```

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --test apps/web/lib/material-jobs/enqueue-policy.test.ts
pnpm check:fleet-skills
pnpm --filter web exec eve build
```

Expected: PASS. With Gateway credentials:

```sh
pnpm eval:material-jobs
```

Expected: all four routing cases PASS.

- [ ] **Step 7: Commit**

```sh
git add apps/web/agent/tools/enqueue_material_job.ts apps/web/lib/material-jobs/enqueue-policy.ts apps/web/lib/material-jobs/enqueue-policy.test.ts scripts/material-job-routing-eval.mts apps/web/agent/skills/materials-studio/SKILL.md apps/web/agent/instructions/sms-mode.ts package.json
git commit -m "feat: enqueue material builds from the studio"
```

---

### Task 11: Run material builds in a separate durable session

**Files:**

- Create: `apps/web/lib/material-jobs/dispatch-input.ts`
- Create: `apps/web/lib/material-jobs/dispatch-input.test.ts`
- Create: `apps/web/lib/material-jobs/completion.ts`
- Create: `apps/web/lib/material-jobs/completion.test.ts`
- Create: `apps/web/lib/materials/delivery.ts`
- Create: `apps/web/lib/materials/delivery.test.ts`
- Create: `apps/web/agent/channels/material-background.ts`
- Create: `apps/web/agent/schedules/material-background.ts`
- Modify: `apps/web/agent/tools/create_printable.ts`
- Modify: `apps/web/agent/tools/show_material.ts`

**Interfaces:**

```ts
export function buildMaterialJobAuth(
  job: MaterialJobRecord,
): SessionAuthContext;

export function buildMaterialJobPrompt(
  job: MaterialJobRecord,
): string;

export async function deliverMaterialBySms(input: {
  phoneNumber: string;
  message: string;
  previewUrl: string;
  pdfUrl: string;
}): Promise<{
  sent: boolean;
  previewSent: boolean;
}>;

export async function completeMaterialJobSession(
  input: {
    jobId: string;
    runtimeSessionId: string;
    sequence: number;
    turnId: string | undefined;
    terminalText: string;
    finishedAt: Date;
  },
  dependencies: MaterialJobCompletionDependencies,
): Promise<
  | { status: "completed"; materialId: string }
  | { status: "failed"; errorCode: string }
  | { status: "already_terminal" }
>;
```

- [ ] **Step 1: Run isolation before completion queries**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing dispatch, completion, and SMS delivery tests**

Assert:

- auth uses `authenticator = material-background`,
- auth channel is `dispatch` for pinned tenancy,
- auth includes family, member when present, episode, and `backgroundJobId`,
- prompt JSON-quotes request text and requires `load_skill materials-studio`,
- prompt forbids enqueue and asks for one passing result,
- completion selects the latest passing or final material from the background session,
- failed attempts are not delivered,
- result message uses original episode and recipient,
- one web or SMS delivery is recorded,
- replay performs no second SMS send,
- no passing material fails with `no_passing_material`,
- shared SMS helper preserves preview-first then link-only fallback behavior.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/material-jobs/dispatch-input.test.ts apps/web/lib/material-jobs/completion.test.ts apps/web/lib/materials/delivery.test.ts
```

Expected: FAIL because the dispatch and completion modules do not exist.

- [ ] **Step 4: Implement pinned dispatch input**

```ts
export function buildMaterialJobAuth(
  job: MaterialJobRecord,
): SessionAuthContext {
  return {
    authenticator: "material-background",
    principalId: `material-job:${job.id}`,
    principalType: "service",
    attributes: {
      channel: "dispatch",
      backgroundJobId: job.id,
      familyId: job.familyId,
      episodeId: job.episodeId,
      originChannel: job.originChannel,
      ...(job.recipientMemberUserId
        ? { memberUserId: job.recipientMemberUserId }
        : {}),
    },
  };
}
```

The prompt contains no raw phone:

```ts
return [
  "Complete one durable material-generation job.",
  "Load the materials-studio skill first and follow it exactly.",
  "Call the existing material tools in this session until one current version passes review or the tools truthfully refuse.",
  "Do not call enqueue_material_job. Background sessions cannot create background work.",
  `Job title: ${JSON.stringify(job.requestTitle)}`,
  `Parent request: ${JSON.stringify(job.requestText)}`,
  job.childId
    ? `Use this family-scoped child id: ${job.childId}`
    : "This material is family-wide.",
  job.revisesMaterialId
    ? `Revise this family-scoped material id: ${job.revisesMaterialId}`
    : "This starts a new revision chain.",
  "Finish with one short parent-facing sentence. Do not paste URLs.",
].join("\n");
```

- [ ] **Step 5: Implement completion and exact delivery**

Completion:

1. Loads the running job by exact job ID and family.
2. Lists materials whose `generation->>'sessionId'` equals the runtime session.
3. Uses `selectParentVisibleMaterialRevisions`.
4. Chooses the exact visible text. Web uses the trimmed terminal sentence. SMS uses `${material.title} is ready to print.` so the canonical row and actual transport body are identical.
5. Persists that visible assistant message with `channel = dispatch`, the background runtime session, and the original episode.
6. Begins one delivery attempt for the original recipient.
7. For web, finishes the attempt as delivered without a network call.
8. For SMS, resolves the original destination hash against family phones, calls `deliverMaterialBySms` with the same visible text, and records sent or failed.
9. Promotes the canonical message only when delivery is sent.
10. Marks the job completed with message, material, and delivery IDs even when SMS delivery failed. `deliveryStatus` preserves the failure.
11. Emits `materials.job_finished`.

The completion function is idempotent. A completed or failed job returns `already_terminal`.

- [ ] **Step 6: Implement the channel and schedule**

Channel state:

```ts
interface MaterialBackgroundState {
  jobId: string | null;
  finished: boolean;
}
```

The channel:

- uses continuation token `material-job:${jobId}`,
- has metadata `adapterName: "material-background"`,
- finishes from its own terminal `message.completed`,
- marks a running job failed on a terminal turn failure,
- exposes a CRON_SECRET-protected `POST /eve/v1/material-background/run` accepting one job ID for controlled tests and operations,
- never accepts family identity from that request.

The schedule:

```ts
export default defineSchedule({
  cron: "* * * * *",
  run({ receive, waitUntil }) {
    waitUntil(runMaterialBackgroundSweep({ receive }));
  },
});
```

The sweep returns immediately when `HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED` is not exact `"true"`. Otherwise it reaps jobs older than 20 minutes as failed, claims at most 10 queued rows, emits `materials.job_started`, starts each through `receive(materialBackgroundChannel, ...)`, and stores the runtime session ID. Startup uncertainty marks failed and never requeues.

- [ ] **Step 7: Reuse one SMS artifact delivery helper**

Move the current preview-plus-PDF send and link-only fallback from both `create_printable.ts` and `show_material.ts` into `apps/web/lib/materials/delivery.ts`. The background completion uses the same helper. This keeps existing inline behavior unchanged.

- [ ] **Step 8: Run GREEN**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/material-jobs/dispatch-input.test.ts apps/web/lib/material-jobs/completion.test.ts apps/web/lib/materials/delivery.test.ts
pnpm material-jobs:e2e
pnpm check:events
pnpm check:isolation
pnpm --filter web exec eve build
```

Expected: PASS. One job gets one session, one current passing material, one canonical result message, and one delivery. Replay does not resend.

- [ ] **Step 9: Commit**

```sh
git add apps/web/lib/material-jobs/dispatch-input.ts apps/web/lib/material-jobs/dispatch-input.test.ts apps/web/lib/material-jobs/completion.ts apps/web/lib/material-jobs/completion.test.ts apps/web/lib/materials/delivery.ts apps/web/lib/materials/delivery.test.ts apps/web/agent/channels/material-background.ts apps/web/agent/schedules/material-background.ts apps/web/agent/tools/create_printable.ts apps/web/agent/tools/show_material.ts
git commit -m "feat: run material builds in durable sessions"
```

---

### Task 12: Expose material job state through history and an authenticated poll

**Files:**

- Create: `apps/web/app/api/material-jobs/active/route.ts`
- Create: `apps/web/lib/material-jobs/view.ts`
- Create: `apps/web/lib/material-jobs/view.test.ts`
- Modify: `apps/web/lib/chat-history.ts`
- Modify: `apps/web/lib/chat-history-model.ts`
- Modify: `apps/web/lib/chat-history-model.test.ts`

**Interfaces:**

```ts
export interface MaterialJobMaterial {
  id: string;
  title: string;
  kind: string | null;
  skill: string | null;
  childName: string | null;
  previewUrl: string;
  pdfUrl: string;
}

export interface MaterialJobView {
  id: string;
  status: MaterialJobStatus;
  deliveryStatus: MaterialJobDeliveryStatus;
  originChannel: "web" | "sms";
  title: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  resultMessageId: string | null;
  message: string | null;
  material: MaterialJobMaterial | null;
}

export function listMaterialJobViewsForMember(input: {
  familyId: string;
  memberUserId: string;
  limit: number;
}): Promise<MaterialJobView[]>;
```

`ChatHistoryPayload` gains:

```ts
materialJobs: MaterialJobView[];
```

- [ ] **Step 1: Run isolation before read queries**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing history and route-view tests**

Cover:

- only the exact family and recipient’s jobs are returned,
- active jobs and recent terminal jobs are bounded newest first,
- a completed job carries only the selected result material,
- a job result message is consumed by the job object and not rendered again as a separate bubble,
- a job result material is consumed by the job object and not rendered again as a detached card,
- a job from the resumed root session is excluded when live Eve events already contain its enqueue tool part,
- an unauthenticated route request returns 401,
- flag-off returns `{ ok: true, enabled: false, jobs: [] }`.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/material-jobs/view.test.ts apps/web/lib/chat-history-model.test.ts
```

Expected: FAIL because job views and job-aware history do not exist.

- [ ] **Step 4: Implement the member-scoped view**

Query jobs by exact `family_id` and `recipient_member_user_id`. Join result rows in separate bounded family-scoped queries. Never return `requestText`, destination hash, runtime session ID, phone, email, review issues, or failed material attempts.

`archiveFromServerHistory`:

1. Builds sets of `resultMessageId` and result material IDs consumed by jobs.
2. Removes those IDs from normal history and normal material reconstruction.
3. Adds one synthetic assistant message per job:

```ts
{
  id: `job:${job.id}`,
  role: "assistant",
  parts: [{
    type: "dynamic-tool",
    state: "output-available",
    toolName: "enqueue_material_job",
    output: {
      queued: true,
      job,
    },
  }],
}
```

This gives reload the same one-object shape as the live enqueue tool result.

- [ ] **Step 5: Implement the active-only poll route**

The route:

1. Checks `materialJobPollingEnabled`.
2. Uses the caller’s Supabase session to get `user.id`.
3. Resolves the caller’s family under RLS.
4. Calls `listMaterialJobViewsForMember`.
5. Returns no-store JSON:

```ts
{
  ok: true,
  enabled: true,
  jobs,
}
```

No request parameter supplies family or member identity.

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/lib/material-jobs/view.test.ts apps/web/lib/chat-history-model.test.ts
pnpm check:chat-ui
pnpm check:isolation
```

Expected: PASS with one job object and no duplicate result message or card.

- [ ] **Step 7: Commit**

```sh
git add apps/web/app/api/material-jobs/active/route.ts apps/web/lib/material-jobs/view.ts apps/web/lib/material-jobs/view.test.ts apps/web/lib/chat-history.ts apps/web/lib/chat-history-model.ts apps/web/lib/chat-history-model.test.ts
git commit -m "feat: expose material job status to chat"
```

---

### Task 13: Render one honest work object and poll only while active

**Files:**

- Create: `apps/web/app/app/material-job-state.ts`
- Create: `apps/web/app/app/material-job-state.test.ts`
- Create: `apps/web/app/app/material-work-item.tsx`
- Create: `apps/web/app/app/material-work-item.test.tsx`
- Create: `apps/web/app/app/chat-client-material-jobs.test.ts`
- Modify: `apps/web/app/app/material-card.tsx`
- Modify: `apps/web/app/app/message-parts.tsx`
- Modify: `apps/web/app/app/chat-client.tsx`
- Modify: `apps/web/app/app/page.tsx`
- Modify: `README.md`

**Interfaces:**

```ts
export const MATERIAL_JOB_PERSISTENT_AFTER_MS = 60_000;
export const MATERIAL_JOB_POLL_MS = 2_500;

export function materialJobPresentation(
  job: MaterialJobView,
  nowMs: number,
): MaterialJobPresentation;

export function hasActiveMaterialJobs(
  jobs: ReadonlyMap<string, MaterialJobView>,
): boolean;

export function mergeMaterialJobViews(
  current: ReadonlyMap<string, MaterialJobView>,
  incoming: readonly MaterialJobView[],
): Map<string, MaterialJobView>;
```

- [ ] **Step 1: Write failing state, component, and wiring tests**

State tests:

```ts
assert.deepEqual(
  materialJobPresentation(runningJob, CREATED_AT + 59_999),
  { kind: "inline", label: "Designing" },
);
assert.deepEqual(
  materialJobPresentation(runningJob, CREATED_AT + 60_000),
  { kind: "persistent", label: "Still working" },
);
assert.deepEqual(
  materialJobPresentation(completedJob, CREATED_AT + 60_000),
  { kind: "ready", label: "Ready" },
);
```

Component tests assert:

- `aria-live="polite"`,
- `aria-busy="true"` only while active,
- title and one status sentence,
- final `MaterialCard` replaces progress inside the same outer job ID,
- delivery failure says the page is ready in Homa while the text did not send,
- phone-safe width and wrapping classes,
- `motion-reduce:transition-none`,
- no progress percentage, countdown, exact completion time, red state, or “behind”.

Wiring tests assert recursive `setTimeout` polling exists only behind `hasActiveMaterialJobs`, merges response jobs, and schedules another timeout only if the merged map remains active.

- [ ] **Step 2: Run RED**

Run:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/app/app/material-job-state.test.ts apps/web/app/app/material-work-item.test.tsx apps/web/app/app/chat-client-material-jobs.test.ts
```

Expected: FAIL because the work object and polling state do not exist.

- [ ] **Step 3: Implement the pure presentation**

```ts
export function materialJobPresentation(
  job: MaterialJobView,
  nowMs: number,
): MaterialJobPresentation {
  switch (job.status) {
    case "queued":
    case "running":
      return nowMs - Date.parse(job.createdAt) >=
        MATERIAL_JOB_PERSISTENT_AFTER_MS
        ? { kind: "persistent", label: "Still working" }
        : { kind: "inline", label: "Designing" };
    case "completed":
      return { kind: "ready", label: "Ready" };
    case "failed":
      return { kind: "failed", label: "Needs another try" };
    default: {
      const exhaustiveStatus: never = job.status;
      return exhaustiveStatus;
    }
  }
}
```

No server call or status mutation occurs at 60 seconds.

- [ ] **Step 4: Implement the compact work object**

Extract the current artifact body from `material-card.tsx` as `MaterialCardContent`. `MaterialCard` keeps its existing framed wrapper for current callers. `MaterialWorkItem` uses the shared unframed body inside its stable outer job object, so ready state does not become a nested second card:

```tsx
<section
  aria-busy={active}
  aria-live="polite"
  className="w-full max-w-sm rounded-lg border border-border-subtle bg-card p-4 shadow-sm transition-shadow motion-reduce:transition-none"
>
  <div className="flex min-w-0 items-start justify-between gap-3">
    <h3 className="min-w-0 break-words font-display text-base font-semibold text-strong">
      {job.title}
    </h3>
    <span className="shrink-0 rounded-pill bg-sky/15 px-2.5 py-1 text-xs font-semibold text-body">
      {presentation.label}
    </span>
  </div>
  {presentation.kind === "inline" ? (
    <p className="mt-2 text-sm text-muted">
      Homa is designing, rendering, and checking one current version.
    </p>
  ) : null}
  {presentation.kind === "persistent" ? (
    <p className="mt-2 text-sm text-muted">
      This is taking longer than usual. Your request is safe, and you can keep chatting.
    </p>
  ) : null}
  {presentation.kind === "ready" && job.material ? (
    <div className="mt-3">
      <MaterialCardContent material={job.material} />
    </div>
  ) : null}
  {presentation.kind === "failed" ? (
    <p className="mt-2 text-sm text-muted">
      This page did not finish. Your request is safe, and Homa can try again when you are ready.
    </p>
  ) : null}
</section>
```

Run the required copy gates in order on these strings: `homa-copy-reviewer`, incorporate accepted feedback, then `homa-copy-editor`.

- [ ] **Step 5: Render enqueue tool parts and merge poll updates**

`message-parts.tsx` recognizes only a strict `enqueue_material_job` output with `queued = true` and a valid `job`.

`ChatClient` initializes a `Map<string, MaterialJobView>` from `serverHistory.materialJobs`. Live enqueue parts are parsed into the same map. `MessageView` receives that map so a job part uses the newest view by ID.

Use one non-overlapping recursive poll:

```ts
useEffect(() => {
  if (
    !materialJobPolling ||
    !hasActiveMaterialJobs(materialJobs)
  ) {
    return;
  }
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function poll(): Promise<void> {
    try {
      const response = await fetch(
        "/api/material-jobs/active",
        { cache: "no-store" },
      );
      const body = await response.json() as MaterialJobsResponse;
      if (cancelled || !body.ok || !body.enabled) return;
      setMaterialJobs((current) => {
        const merged = mergeMaterialJobViews(
          current,
          body.jobs,
        );
        if (hasActiveMaterialJobs(merged)) {
          timer = setTimeout(
            () => void poll(),
            MATERIAL_JOB_POLL_MS,
          );
        }
        return merged;
      });
    } catch {
      if (!cancelled) {
        timer = setTimeout(
          () => void poll(),
          MATERIAL_JOB_POLL_MS,
        );
      }
    }
  }

  void poll();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
  };
}, [materialJobPolling, materialJobs]);
```

If React dependency behavior causes the effect to restart on every map update, derive a stable active-ID key and depend on that key instead. Keep exactly one timer.

- [ ] **Step 6: Preserve composer and queue behavior**

- Do not add material jobs to Eve’s `busy` calculation.
- The root enqueue turn still uses the existing visible queue and flushes it on root turn finish.
- Once the root turn ends, the composer sends new messages immediately while the material job runs.
- A new critique does not mutate, migrate, cancel, or restart the in-flight job. If the new turn intentionally starts another material build, it receives a separate durable job and work object.
- Keep the queue’s cancel and send-now behavior unchanged.

Add a regression that `prepareChatSend({ busy: false, ... })` sends while a background job is active, while `busy: true` still queues during the short root turn.

- [ ] **Step 7: Run GREEN and verify phone, motion, and real UI**

Run focused tests:

```sh
pnpm exec tsx --tsconfig apps/web/tsconfig.json --test apps/web/app/app/material-job-state.test.ts apps/web/app/app/material-work-item.test.tsx apps/web/app/app/chat-client-material-jobs.test.ts apps/web/app/app/chat-send-policy.test.ts
pnpm check:progress-ui
pnpm check:chat-ui
```

Expected: PASS.

With a local authenticated synthetic family:

1. Capture desktop and phone screenshots at queued, 59 seconds, 60 seconds, completed, and failed.
2. Confirm the composer remains usable and the queue remains visible during the root turn.
3. Confirm completion arrives without reload and the network stops calling the poll route.
4. Enable reduced motion and confirm no animated transition is required to understand state.
5. Run `homa-uxui-reviewer` against the screenshots and fix accepted issues before commit.

- [ ] **Step 8: Commit**

```sh
git add apps/web/app/app/material-job-state.ts apps/web/app/app/material-job-state.test.ts apps/web/app/app/material-work-item.tsx apps/web/app/app/material-work-item.test.tsx apps/web/app/app/chat-client-material-jobs.test.ts apps/web/app/app/material-card.tsx apps/web/app/app/message-parts.tsx apps/web/app/app/chat-client.tsx apps/web/app/app/page.tsx README.md
git commit -m "feat: render one honest material work item"
```

---

### Task 14: Add exact-session repair and safe production backfill

**Files:**

- Create: `scripts/conversation-reliability-repair-lib.ts`
- Create: `scripts/conversation-reliability-repair.test.ts`
- Create: `scripts/conversation-reliability-repair.mts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

```ts
export interface DelegatedSessionManifest {
  auditSource: "eve-event-replay";
  auditedAt: string;
  auditedDelegatedSessionIds: string[];
}

export interface ConversationRepairPlan {
  delegatedSessionIds: string[];
  repairStaleProgressLoops: boolean;
  apply: boolean;
}

export interface ConversationRepairCounts {
  delegatedMessages: number;
  delegatedDeliveries: number;
  delegatedBindings: number;
  staleProgressLoops: number;
}
```

- [ ] **Step 1: Run isolation before repair queries**

```sh
pnpm check:isolation
```

Expected: PASS.

- [ ] **Step 2: Write failing dry-run and exact-scope tests**

Cover:

- dry-run executes the real transaction and rolls it back,
- apply commits,
- an empty or malformed manifest refuses,
- the manifest requires exact `auditSource`, a valid offset timestamp, unique nonempty session IDs, and no wildcard or prefix matching,
- only exact supplied session IDs have their messages changed to `visibility = 'internal'`,
- only deliveries and open loops attached to those exact child-session messages are deleted,
- exact runtime bindings are deleted,
- model usage, tool calls, context snapshots, and founder traces remain,
- stale progress repair uses the same invariant as Task 3,
- no progress state, evidence, response, score, child, or family row changes,
- output contains only counts and session hashes.

- [ ] **Step 3: Run RED**

Run:

```sh
pnpm exec tsx --test scripts/conversation-reliability-repair.test.ts
```

Expected: FAIL because the repair modules do not exist.

- [ ] **Step 4: Implement audited-session scoping**

Historical leaked sessions predate the new `conversation.session_delegated` event, so the repair must not require that future metadata. The operator manifest is the explicit output of the audited Eve event replay. Validate:

1. `auditSource` is exactly `eve-event-replay`.
2. `auditedAt` is a valid ISO timestamp with an offset.
3. The ID list is nonempty, unique, and each value is a nonempty exact session ID.
4. The SQL uses `= any($audited_session_ids)` only. It never uses `like`, a prefix, a time window, message content, or a family-wide update or deletion.
5. Output replaces every raw ID with its SHA-256 display hash.

When a supplied ID also has a new delegated event hash, report `event_corroborated=true` in bounded metadata. Absence is allowed for the historical repair.

Preserve the delegated transcript for founder audit, but remove it from every family-visible and reply-causality path:

```sql
delete from public.conversation_thread_bindings
where runtime_session_id = any($audited_session_ids);

delete from public.conversation_open_loops loop
using public.conversation_deliveries delivery,
      public.conversation_messages message
where loop.delivery_id = delivery.id
  and delivery.message_id = message.id
  and message.session_id = any($audited_session_ids);

delete from public.conversation_deliveries delivery
using public.conversation_messages message
where delivery.message_id = message.id
  and message.session_id = any($audited_session_ids);

update public.conversation_messages
set visibility = 'internal'
where session_id = any($audited_session_ids)
  and visibility = 'family';
```

Do not delete delegated messages, `model_usage`, `agent_tool_calls`, `session_context_snapshots`, or delegated event metadata. Founder trace remains available while authenticated family history and continuity resolution stop seeing the child sessions.

Run stale-loop cancellation with the Task 3 predicate.

- [ ] **Step 5: Implement the explicit operational command**

Command contract:

```text
HOMA_CONVERSATION_DATABASE_URL is required.
--delegated-session-manifest /absolute/path.json is required for delegated repair.
--repair-stale-progress-loops enables the fleet-safe loop repair.
--apply commits. Without --apply, the command rolls back.
--json prints counts and hashes.
Unknown arguments fail.
```

Add:

```json
"conversation:repair": "tsx scripts/conversation-reliability-repair.mts"
```

- [ ] **Step 6: Run GREEN**

Run:

```sh
pnpm exec tsx --test scripts/conversation-reliability-repair.test.ts
pnpm check:continuity
pnpm check:isolation
```

Expected: PASS. Dry-run reports exact counts and leaves fixtures unchanged. Apply changes only audited child sessions and stale loop metadata.

- [ ] **Step 7: Commit**

```sh
git add scripts/conversation-reliability-repair-lib.ts scripts/conversation-reliability-repair.test.ts scripts/conversation-reliability-repair.mts package.json README.md
git commit -m "fix: repair audited conversation state"
```

---

## Full verification gate

Run from the worktree after Task 14 and before push:

```sh
pnpm typecheck
pnpm lint
pnpm check:continuity
pnpm check:child-progress
pnpm check:progress-ui
pnpm check:chat-ui
pnpm check:research-brief
pnpm check:fleet-skills
pnpm check:isolation
pnpm check:events
pnpm child-progress:e2e
pnpm material-jobs:e2e
pnpm --filter web build
pnpm --filter web exec eve build
```

Expected: every command exits 0.

With Gateway credentials:

```sh
pnpm eval:continuity
pnpm eval:research-brief
pnpm eval:material-jobs
```

Expected: all behavioral cases PASS.

Run the focused local journey with flags on:

```sh
HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED=true HOMA_BACKGROUND_MATERIAL_POLLING_ENABLED=true pnpm --filter web dev
```

In a second process:

```sh
pnpm --filter web exec eve dev
```

Use a synthetic family only. Verify:

1. A material request creates one job before the root turn ends.
2. The root does not call `generate_image` or `create_printable`.
3. The background session loads materials-studio and calls existing tools.
4. A second chat message sends while the job remains running.
5. The work object changes at 60 seconds without a server state transition.
6. Completion enters the open tab without reload.
7. Poll requests stop after terminal state.
8. Reload shows one job object and one latest passing material.
9. Failed review attempts appear in founder admin and not as parent-ready cards.
10. The generated PDF retains `made with Homa for [child]`.
11. A background session calling `enqueue_material_job` is refused.
12. No runtime error appears in local logs.

## Code-first production rollout

### 1. Push code with flags dark

Push the reviewed branch. Do not apply either migration first. Keep:

```text
HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED unset
HOMA_BACKGROUND_MATERIAL_POLLING_ENABLED unset
```

The F1, F2, F4, F5, and F6 foundation corrections activate with code. The F3 application cancellation activates with code; its database trigger and historical backfill wait for migration.

### 2. Verify Vercel READY and public safety

Wait for the intended Git deployment to report READY. Record deployment ID, commit, and READY time.

Public probes:

```sh
curl -fsS -o /dev/null -w "%{http_code}\n" https://thankshoma.com/
curl -fsS -o /dev/null -w "%{http_code}\n" https://thankshoma.com/signin
curl -sS -o /dev/null -w "%{http_code}\n" https://thankshoma.com/api/material-jobs/active
```

Expected: landing and sign-in are 200. The unauthenticated job route is 401 or the existing auth redirect posture. It never returns job data.

Verify Vercel runtime errors from deployment time through the probe. Expected: zero new errors attributable to this deploy.

### 3. Apply additive migrations

Apply only the two reviewed new migration files after code is READY:

1. `_conversation_progress_loop_cleanup.sql`
2. `_material_background_jobs.sql`

Run:

```sh
pnpm check:isolation
pnpm child-progress:e2e
pnpm material-jobs:e2e
```

Expected: PASS against the migration shape used for rollout.

### 4. Run health audit and dry-run repair

Create `/tmp/homa-audited-delegated-sessions.json` from the production Eve audit evidence:

```json
{
  "auditSource": "eve-event-replay",
  "auditedAt": "2026-07-15T22:00:00-04:00",
  "auditedDelegatedSessionIds": [
    "one exact audited Eve child session id per entry"
  ]
}
```

Do not add this file to git. Populate it only from the audited Eve event replay. The repair does not discover additional sessions.

Run:

```sh
HOMA_CONVERSATION_DATABASE_URL="postgres://..." pnpm conversation:health -- --since-hours 168 --json
HOMA_CONVERSATION_DATABASE_URL="postgres://..." pnpm conversation:repair -- --delegated-session-manifest /tmp/homa-audited-delegated-sessions.json --repair-stale-progress-loops --json
```

Expected: health findings are PII-minimized. Repair reports `mode=dry-run` and exact counts. Review counts against the audit.

Apply only after counts match:

```sh
HOMA_CONVERSATION_DATABASE_URL="postgres://..." pnpm conversation:repair -- --delegated-session-manifest /tmp/homa-audited-delegated-sessions.json --repair-stale-progress-loops --apply --json
```

Rerun dry-run. Expected: zero family-visible delegated rows, zero child-session deliveries and open loops, and zero stale progress loops.

### 5. Verify the unflagged foundation in production

Use a synthetic authenticated family:

- Run a parented-session probe. Root receives the fixed child marker; family history receives no child prompt, reply, or delivery.
- Exercise early progress narration followed by terminal assistant text. Live and reload text match.
- Create a three-revision material chain with one failed review. Parent history shows one latest passing card; founder admin shows all attempts and review issues.
- Run a valid 600-character research brief through a controlled task. It reaches its selected channel.
- Run a 601-character brief fixture. The task fails at `output_gate`; SMS and email attempt counts stay zero.
- Run the competing-topic exact-reply probe. The bound offer wins.

Do not use or alter a real family’s progress.

### 6. Enable background execution, then polling

Set:

```text
HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED=true
```

Wait for READY. Create one synthetic web material job and verify the backend lifecycle before exposing polling.

Then set:

```text
HOMA_BACKGROUND_MATERIAL_POLLING_ENABLED=true
```

Wait for READY again.

### 7. Verify the authenticated one-honest-thread flow

With a synthetic authenticated family:

1. Ask for a material.
2. Confirm one work object appears and the composer stays available.
3. Send another ordinary chat message while the job runs.
4. Confirm inline state before 60 seconds and persistent state at or after 60 seconds.
5. Keep the tab open and confirm the ready material replaces progress without reload.
6. Confirm network polling stops.
7. Reload and confirm no duplicate result bubble or detached card.
8. Open founder admin and confirm failed attempts remain visible.
9. Open the PDF and confirm the D7 footer.

### 8. Verify linked SMS only when a controlled test phone is available

Use a dedicated synthetic family and child linked to the controlled test phone. Never use a real family or mutate a real family’s progress.

- Ask for one material by SMS.
- Confirm the root acknowledges quickly and the durable job runs separately.
- Confirm the passing preview and PDF arrive once.
- Send a competing-topic reply and confirm exact target behavior.
- Reissue, pause, stop, and complete synthetic progress check-ins only in the synthetic family. Confirm stale loops close.

If no controlled test phone is available, record this SMS production probe as skipped for that explicit reason. Do not substitute a real parent’s phone.

### 9. Final runtime and rollback checks

Run the PII-minimized health audit again for the post-enable window. Inspect Vercel runtime errors. Expected: no delegated leaks, stale progress loops, avoidable brief fallbacks, terminal-delivery lag, or duplicate material bursts from the synthetic journey.

Rollback order:

1. Set `HOMA_BACKGROUND_MATERIAL_POLLING_ENABLED` dark.
2. Set `HOMA_BACKGROUND_MATERIAL_JOBS_ENABLED` dark.
3. Wait for READY and probe chat.
4. Leave additive tables, lifecycle events, foundation fixes, and repaired metadata in place.
5. Never reset a running job to queued and never drop the ledger during rollback.

## Requirement coverage check

- F1: Task 1 plus Task 14.
- F2: Task 2.
- F3: Task 3 plus Task 14.
- F4: Task 4.
- F5: Task 5.
- F6: Task 6.
- PII-minimized health audit: Task 7.
- Durable material job backend: Tasks 8 through 11.
- One honest thread, active polling, 60-second UI, accessibility, phone, reduced motion, and queue behavior: Tasks 12 and 13.
- Additive migrations and code-first rollout: Tasks 3 and 8 plus rollout steps 1 through 6.
- Typed lifecycle events and existing cost ownership: Tasks 1 and 8 through 11.
- Exact-session repair and safe progress-loop backfill: Task 14 and rollout step 4.
- Required local, Eve, Next, isolation, event, fleet-skill, progress, continuity, and focused E2E gates: Full verification gate.
- Vercel READY, public probes, authenticated web, controlled SMS, and runtime errors: Production rollout.

Execution begins with Task 1 under the subagent-driven protocol above.
