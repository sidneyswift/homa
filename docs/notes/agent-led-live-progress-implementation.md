# Agent-led live progress implementation notes

## 2026-07-11

### Plan-confirmed

- The build starts from the approved `ChildProgress` design.
- Existing `child_answers` and `child_reports` remain compatibility projections.
- Token reports remain available while the signed-in app gains a live Progress view.
- Shared question-queue behavior moved into `@homa/core` behind compatibility exports.
- Journal evidence classification now requires the child name in the same concrete skill clause. Ambiguous pronouns stay out of progress.
- Agent check-in selection ranks unanswered items, low-coverage subjects, then oldest evidence, with explicit bundled-item exclusion and fallback.

### Deviation

1. **What the plan said:** Use an isolated worktree.
2. **What the code revealed:** Required multi-parent and conversation-continuity changes are uncommitted in the current non-main branch.
3. **Conservative choice:** Build in the current branch without committing or touching unrelated changes.
4. **Revisit:** Move future work to an isolated worktree after prerequisite changes are committed.

### Discovery

- Before Task 9, `recordObservation` called `createReport` for every item and
  appended one legacy history entry per observation. The store API and its Eve
  tool are now removed and disabled respectively.
- The current bank contains bundled prompts such as `math.skip-counting`. Agent-led check-ins will exclude bundled items until individual skills have reviewed anchors.
- The existing app already has the needed hierarchy curation in `BANK_ITEM_DOMAINS`, but no parent-facing domain/topic read model.

### Todo for human

- Production migration application, feature-flag activation, Vercel READY verification, and authenticated production probes remain external rollout actions. They do not block local implementation or tests.

## 2026-07-11 Task 2

### Task 2 plan-confirmed

- The additive ChildProgress schema landed in the generated migration with all six planned tables, the real-answer legacy backfill, family-scoped reads, indexes, and isolation coverage.

### Task 2 discovery

- `child_answers.source` is unconstrained and existing writers can emit values outside the new evidence source set. The backfill preserves supported provenance and normalizes unsupported or null values to `legacy`.

### Task 2 deviation

1. **What the plan said:** The draft allowed authenticated family members to mutate ChildProgress rows through RLS.
2. **What the code revealed:** ChildProgress mutations belong to the server-only `mapDb` seam, matching conversation history and generated curriculum storage.
3. **Conservative choice:** Authenticated Data API callers receive SELECT policies only. No INSERT, UPDATE, or DELETE policy exists on any new table.
4. **Revisit:** Add a client mutation policy only if a future reviewed design deliberately moves a specific write out of the server seam.

### Task 2 todo for human

- Apply the migration through the approved deployment process before the remote isolation guard or ChildProgress end-to-end checks can pass. This local implementation does not apply it to any remote database.

## 2026-07-11 Task 2 hardening

### Composite-family hardening

- Every ChildProgress row now stores `family_id` and proves `(child_id, family_id)` against `children`. Composite identities and foreign keys also bind check-ins, evidence, conflicts, snapshots, conversation provenance, and responses to one child and family.
- Private deferred constraint triggers verify adult attribution against `family_members` and enforce response, conflict, resolution, and snapshot invariants.

### Legacy reconciliation

- An early draft used a transitional `child_answers` trigger. Task 5 quality review removed it before migration application because its reverse write path could deadlock with ChildProgress compatibility updates.
- The migration now provides one explicit, idempotent reconciliation function. Task 9 moves remaining writers first, then rollout runs reconciliation immediately before enabling live progress.

## 2026-07-11 Task 2 final schema hardening

### Server-only compatibility boundary

- Authenticated callers retain SELECT access to `child_answers`, but its INSERT, UPDATE, and DELETE policies and privileges are removed. Repository search found only caller-token reads in `agent/instructions/family-context.ts` and `lib/dashboard.ts`; every current writer uses direct `mapDb` SQL.
- The explicit reconciliation function takes a `SHARE ROW EXCLUSIVE` lock on `child_answers`, so its snapshot and legacy supersession run against one stable compatibility state.

### Historical integrity

- New or changed open conflicts require two distinct attributed adults. Later Auth account deletion may null historical actor columns without invalidating the stored conflict.
- An open-to-resolved transition requires a resolver. Resolved history permits that resolver reference to become null after account deletion.
- Response evidence now matches member attribution, and evidence supersession rejects self-links and cross-item links.
- Deferred family-member checks reload each row by primary key, so multiple `ON DELETE SET NULL` actions validate one final state instead of stale intermediate trigger events.
- Direct resolved-conflict inserts require two distinct attributed evidence rows and a resolver. Historical rows may still lose those nullable Auth references later.

## 2026-07-11 Task 3

### Task 3 plan-confirmed

- Effective evidence excludes superseded rows, applies deterministic observed-time, created-time, and evidence-ID tie breaks, and removes open conflicts from scoring. Both rows linked by an open conflict must still be active.
- A resolution controls active evidence created at or before `resolvedAt`. Its selected row represents that earlier set, while evidence created later competes with it under normal ordering. A superseded selected row invalidates the resolution and falls back to the latest active row.
- The pure live projection groups bank and assessment-only taxonomy evidence into the approved subject, domain, and topic hierarchy. `projection.server.ts` is the thin `server-only` boundary for future Next routes, repositories, and server libraries, while pure tests import `projection.ts` directly.
- Topic freshness and child age use the family's IANA calendar date. Birthday boundaries no longer depend on the UTC date.
- Raw quotes remain only in ledger input. Materialized topics and conflict entries retain safe source kind, adult display name, check-in provenance, answer, and observation time without copying verbatim parent text.
- Evidence and conflict timestamps require a real offset-bearing ISO value. Calendar fields, clock fields, numeric offsets, and RFC3339's unknown `-00:00` offset are validated before ordering.
- Accepted fractional precision, including Postgres six-digit fractions, is padded to nanoseconds and compared as `bigint` for observed, created, and resolved instants. Equivalent offset forms produce the same integer instant.
- Every rendered subject may receive one truly unanswered, age-eligible bank item from the existing agent selector. Complete check-in and checklist response coverage, including `not_sure` and `skip`, is merged by the general `selectionId`; evidence-backed selections also retain a nullable `evidenceId` for provenance.
- Subject, domain, and topic ordering follows the map registry, taxonomy domain registry, and age or teaching-window order with stable ASCII ID tie breaks.
- Topic views are state-discriminated, and the live conflict list contains open conflict views only.

### Task 3 discovery

- `domainForBankItem` already owned the curated bank-to-domain lookup but no longer had a root `@homa/core` export because it previously had no external consumer. The pure projection is now that consumer, so the public export is restored.
- Conflict rows do not duplicate parent-facing names, answers, or safe source provenance. The projection derives both complete adult entries from the referenced evidence, which prevents conflict metadata from drifting from the ledger while keeping quotes private.
- The schema stores a conflict's opening time as `created_at`. The later repository adapter must map that value to the domain type's `observedAt` field.
- A resolved conflict is a cutoff, not a permanent pin. Pre-resolution nonselected evidence cannot override it, but later-created active evidence can become effective.
- JavaScript `Date` truncates fractional seconds after milliseconds, so it cannot decide ledger tie breaks. The strict parser uses `Date` only for the whole-second UTC anchor, then adds the full accepted fraction with integer arithmetic.
- The web TypeScript target is ES2017, so bigint literal syntax fails typecheck even though the `esnext` library exposes `bigint`. The implementation uses `BigInt(...)` constants and keeps every ordering comparison in bigint space.
- `@homa/taxonomy/progress` reads only domain metadata and a checked-in generated assessment-topic index. The runtime path no longer imports topics, assembly, dependencies, clusters, standards, or the root graph API.
- `pnpm taxonomy:progress` is the explicit full-assembly generation step. The first generated index contains 1,347 assessment topics in 219,428 bytes; `check:taxonomy` compares it with the assembled source to prevent drift.

## 2026-07-11 Task 4

### Task 4 plan-confirmed

- `ChildProgressService` now owns idempotency, supersession, conflict policy, projection rebuilds, and deterministic compatibility decisions across one repository transaction.
- The Postgres adapter locks the scoped child, writes evidence and conflicts, materializes `child_progress_live`, updates or deletes anchored `child_answers`, updates an existing `child_reports` row without changing token or history, and touches the family.
- Journal callers cannot provide item IDs. The deterministic matcher classifies activity first, limits matching to direct named-child clauses, excludes the agent check-in denylist, and supports one strong match or independent matched-many evidence.
- Live reads prefer saved projection JSON and derive a read-only fallback from the complete ledger and all check-in responses when no live row exists.

### Task 4 discovery

- The `server-only` marker intentionally throws under the bare `tsx` test condition. The production composition in `child-progress/index.ts` injects `buildChildProgressView` from `projection.server.ts`, while service tests inject the same pure builder from `projection.ts`.
- One journal quote may match more than one independent item, while the evidence table has one idempotency key per row. The service derives stable per-match keys and claims the whole deterministic key set under the child lock, so a replay returns one duplicate outcome without another projection write.
- Postgres timestamp text is not safe input for the strict domain parser. Repository queries now render every evidence, response, and conflict timestamp as UTC ISO text with a fixed six-digit microsecond fraction.
- A failed matched-many write rolls back the complete batch through the repository transaction seam. The in-memory adapter test proves this without database credentials.

### Task 4 local adapter verification

- A temporary PostgreSQL 17 cluster exercised the real adapter against a minimal local schema. It recorded matched-many journal evidence, opened a two-adult conflict, removed the conflicted compatibility answer, preserved report token and history, omitted the quote from live JSON, and derived the no-write fallback view.
- Later Task 5 quality hardening removed the reverse compatibility trigger and its suppression setting before the migration was applied.

### Task 4 review hardening

- Duplicate outcomes now identify a conflict only when the replayed evidence was stored as that conflict's `evidence_id_b`. A later conflict that merely references earlier evidence as `evidence_id_a` does not rewrite the earlier operation's original result.
- Public write results copy storage rows into the exact `ProgressEvidence` shape, so repository-only idempotency keys do not cross the service interface.
- Fallback projection reads now issue `SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY` before the child, evidence, conflict, or response query. The local PostgreSQL smoke blocked the evidence read, committed a new response concurrently, and confirmed that the in-flight fallback snapshot did not observe it.

### Task 4 quality hardening

- Journal and direct write inputs no longer accept child or adult display names. The service locks and loads the family-scoped child before matching, and repositories derive adult names from `family_members`.
- Journal matching now scores child-attributed predicates separately. Each match carries its clause span and answer, other named actors do not inherit the child's attribution, reading and retelling land on separate items, and negative pedal evidence maps to `gross_motor.pedals`.
- Durable `child_progress_operations` receipts own idempotency independently of current matcher, bank, evidence, or conflict state. A reused key with a different payload is rejected, while an exact replay returns the strict stored result.
- Ordinary writes to an item with an open conflict now return `conflict_pending` before append. Task 5 owns conflict resolution.
- Live JSON is recursively strict, versioned, dated by the family calendar, and invalidated by canonical child changes or ledger count drift.
- Selection responses linked to ledger evidence are reconciled away, while independent `not_sure` and `skip` responses remain. Selection ordering now preserves full Postgres fractional precision through the shared timestamp parser.
- The in-memory repository now serializes transactions against isolated drafts. Failed drafts cannot overwrite later successful commits, and receipt and evidence uniqueness mirror production constraints.

### Task 4 quality deviation

1. **What the plan said:** ChildProgress storage had six additive tables.
2. **What the code revealed:** Evidence-row idempotency cannot preserve an exact multi-item operation result after matcher, bank, or conflict changes.
3. **Conservative choice:** Add the seventh server-only `child_progress_operations` receipt table in the still-unapplied migration.
4. **Revisit:** Task 10 should retain the receipt attacks and concurrent snapshot probe in its permanent Postgres E2E harness.

### Task 4 quality local verification

- A temporary PostgreSQL 17 cluster applied the full migration transactionally against a minimal prerequisite schema, then ran the real adapter.
- The smoke proved exact receipt replay and mismatch rejection, conflict-pending behavior, trusted adult-name derivation, explicit legacy reconciliation, report token and history preservation, strict live invalidation, response mapping, operation constraint rejection, and a repeatable-read concurrency snapshot.

### Task 4 final quality hardening

- Bundled `literacy.reads-short-book` now joins `literacy.chapter-books` in the agent exclusion registry. Journal reading aliases target the single-skill `literacy.emergent-reader` anchor instead.
- Matcher predicate boundaries now treat `while` and `whereas` as potential actor transitions. Omitted-subject negative predicates and "lots of help" retain their own polarity.
- The eighth server-only table, `child_progress_revisions`, stores one monotonic bigint revision per child and family. Source-table triggers bump it for evidence, conflicts, responses, child identity, family time zone, and relevant family-member name or deletion changes.
- Live rows store `source_revision`. The adapter reloads the canonical revision after transaction writes and rejects a live projection whenever its revision differs, even when row counts stay unchanged.
- Check-in provenance is now type-enforced and runtime-validated. `check_in` writes require a non-empty `checkInId`, while every other direct source rejects one.
- `scripts/child-progress-postgres-test.mts` is the committed Task 10-ready adapter harness. It discovers local PostgreSQL binaries, creates and removes a disposable cluster and database, applies the current migration, and exercises concurrency, rollback, receipts, explicit reconciliation, report preservation, repeatable reads, and every source-revision trigger class.

### Task 4 source-revision deviation

1. **What the plan said:** Live invalidation could rely on bank, schema, date, identity, and row counts.
2. **What the code revealed:** Supersession, response replacement, time-zone edits, and adult display-name changes can change projection meaning without changing evidence or conflict counts.
3. **Conservative choice:** Add `child_progress_revisions` and trigger every projection source rather than teaching the read path a growing collection of timestamps.
4. **Revisit:** Task 10 should run the committed PostgreSQL harness on each supported local platform before it becomes a CI requirement.

### Portability concern

- The committed PostgreSQL harness currently targets macOS and Linux conventions. It searches Homebrew formulas and `PATH`, uses a short `/tmp` socket path, and accepts `HOMA_POSTGRES_BIN`; Windows portability is not yet proven.

### Task 4 final race hardening

- Matcher clauses now stop at any later non-child proper name or adult-role subject, even when modifiers separate that actor from the skill predicate. Causal text such as "Maya listened because Jordan successfully retold the story" cannot become Maya evidence.
- Write transactions lock the child, ensure and lock its revision row, then reload canonical child name, birth date, and family time zone before reading evidence, conflicts, or responses. The final source revision is read again with `FOR UPDATE` after this transaction's writes.
- Canonical revision triggers use an upsert on the same revision row, so concurrent time-zone and member mutations wait for the evidence transaction to commit. Their later bump makes the just-saved live projection immediately stale.
- The family timestamp touch uses `FOR UPDATE SKIP LOCKED`. A concurrent family settings update can hold the family row while waiting on the revision lock without deadlocking the evidence transaction; the settings update itself remains the newer family activity.
- The committed PostgreSQL harness proves a time-zone commit between initial child lookup and revision lock is reloaded before projection, both post-lock source races, and same-item compatibility concurrency without a reverse trigger.

## 2026-07-11 Task 5

### Task 5 plan-confirmed

- `ProgressCheckInService` now owns start, response, pause, resume, explicit takeover, stop, delivery binding, conflict resolution, and scoped read helpers.
- A start locks the child and source revision before the check-in row, selects the server item, stores revision 1, and inserts one `check_in_group` baseline snapshot of the current projection and scores.
- Responses claim durable idempotency and provider-message provenance before evidence work. Evidence answers call `recordProgressEvidenceInTransaction` inside the same repository transaction, while `not_sure` and `skip` remain response-only coverage.
- Every accepted response appends its in-memory selection coverage before choosing the next item. Post-response selection disables refresh, so exhausted scope completes instead of asking the same item again.
- Topic pauses and cross-channel resumes preserve the prompt. Takeover changes the owner and recipient only after an explicit authenticated request. Stop preserves all evidence, writes no report, and frees the partial unique slot.
- Conflict resolution selects one of the two stored evidence rows by exact answer, records the resolver, rebuilds live and compatibility state without synthetic evidence, and resumes or completes the related check-in.

### Task 5 discovery

- Exact duplicate response replay needs the original workflow result after the check-in revision has moved. The response row now stores channel, provider message ID, and result JSON in addition to its existing idempotency key.
- An evidence response must claim its response row before appending evidence. The row begins with a transaction-local pending result, then receives the evidence ID and final result before commit.
- Response completion updates only linkage and replay metadata. The source-revision trigger now bumps on response insert, delete, or selection-semantic updates, avoiding an immediately stale live projection after completion metadata is attached.
- `not_sure` and `skip` advance durable workflow coverage without calling the derived compatibility writer. Their response insert invalidates an older live row through the source revision, so a later read rebuilds accurately without changing report scores or narrative.
- The evidence service keeps its narrow `ChildProgressTransaction` dependency. `ProgressCheckInTransaction` and `ProgressCheckInRepository` extend those interfaces with workflow persistence instead of forcing unrelated evidence fakes to implement check-in methods.
- If conflict resolution leaves no next server item, the related paused check-in becomes completed. Otherwise it resumes active with the already selected next prompt.
- Conflict resolution preserves the paused check-in's episode when the resolver is a different adult. Only explicit takeover changes ownership, and later delivery binding requires the delivery recipient to match the pinned check-in recipient.

### Task 5 current-plan clarification

- The older executable plan placed the grouped snapshot at stop. The current Task 5 contract explicitly requires the baseline at start and exactly once per check-in. The implementation follows the current contract and stop creates no second snapshot.

### Task 5 local verification

- Focused TDD first failed on the missing service, then on ten behavioral assertions against a deliberate stub. The final focused workflow suite passes all start, CAS, recipient, delivery, duplicate, pause, takeover, stop, conflict, and read-helper cases.
- The committed PostgreSQL harness now proves racing start, response CAS, idempotency and provider replay, takeover, stop, snapshot uniqueness, exact conflict resolution, compatibility rebuilding, and no pending Task 5 responses in a disposable local PostgreSQL cluster.

### Task 5 rollout concern

- The migration remains local and unapplied. Task 6 still needs real delivery binding, and Task 9 must move every direct progress writer before the final reconciliation and flag activation.

### Task 5 delivery-contract hardening

- Response delivery matching now uses nullable equality in both service policy and the SQL insert guard. Only null with null or the same non-null delivery ID can answer a prompt.
- Durable duplicate replay first matches the stored response member and delivery to the current authenticated context. A mismatched replay returns `wrong_recipient` or `wrong_delivery` without exposing the original result.
- Delivery binding now returns a discriminated result. Empty IDs, mismatched recipients, stale revisions, terminal workflows, and attempts to replace an existing binding receive typed refusals.
- Focused tests now cover every bind result, both null-delivery mismatch directions, duplicate replay refusals, exact conflict-card attribution, saved-response pause and resume, and answers after terminal states.
- The committed PostgreSQL harness directly attacks the SQL response guard before and after binding, then verifies typed binding and duplicate replay against the real adapter.

### Task 5 final quality hardening

- The unapplied migration no longer creates a reverse `child_answers` trigger. ChildProgress compatibility writes therefore have no lock path back into evidence or source revisions.
- `private.reconcile_child_answers_to_progress()` performs the initial backfill and the final rollout reconciliation. It locks the compatibility table, inserts deterministic current evidence, and supersedes stale legacy reconciliation rows idempotently.
- Family-member removal pauses affected nonterminal check-ins with `member_removed`, clears ownership, recipient, and delivery, and increments the prompt revision. Explicit takeover by a current family member resumes the saved prompt.
- Prompt lookup now requires exact nullable recipient and delivery equality. Cross-channel resume clears the old delivery before the prompt becomes active again.
- Conflict resolution uses `child_progress_operations` receipts. Payload hashing covers conflict ID and chosen answer, exact retries replay the strict stored result, and changed-answer retries return `idempotency_mismatch`.
- Strict recursive schemas validate check-in records, prompts, conflict cards, response outcomes, and conflict-resolution receipts. Database constraints enforce every state and response-status shape, while conflict resolution can select only evidence A or B.
- The local PostgreSQL harness proves the reconciliation sequence, direct state rejection, same-child and same-item concurrency without a bridge deadlock, member and Auth deletion transitions, exact conflict replay, and third-row resolution rejection.

### Task 5 rollout order

1. Complete Task 9 so direct progress writers use ChildProgress.
2. Deploy code with the live-progress flag off and wait for READY.
3. Apply the additive migration and initial backfill.
4. Run `select * from private.reconcile_child_answers_to_progress();`.
5. Enable `HOMA_LIVE_PROGRESS_ENABLED`, then probe web and linked SMS.

### Task 5 reconciliation and lifecycle lock hardening

- Reconciliation now preserves every evidence row referenced by an open conflict and skips legacy insertion only when active evidence matches the current item, answer, canonical source, and observation timestamp exactly.
- `CHILD_PROGRESS_RECONCILIATION_ADVISORY_LOCK_KEY` is the one code and migration lock key. Normal ChildProgress transactions take a shared transaction lock as their first statement. Final reconciliation takes the exclusive transaction lock before locking `child_answers`.
- Authenticated member rows are locked `FOR KEY SHARE` before child, revision, or check-in rows. Removed actors return `unknown_actor` for evidence and `wrong_recipient` for check-ins without mutation.
- The membership-removal trigger takes the shared global lock, then locks child rows, revision rows, and check-ins in that order. Concurrent start and takeover complete before removal, after which the trigger pauses and clears the new ownership safely.
- Takeover checks linked open conflicts regardless of pause reason. `member_removed` remains trigger-only, requires cleared ownership and delivery in Postgres, and cannot be produced through the public pause command.
- Postgres probes cover open-conflict reconciliation, exact Task 9 evidence, advisory quiescence, same-item final correctness, and concurrent member removal against both start and takeover.

### Task 5 final concurrency closure

- Reconciliation never supersedes evidence held by an open conflict. It also treats any active exact child, item, and answer row as authoritative, independent of idempotency prefix.
- Every repository write transaction takes the shared global advisory lock before its first domain query. Final reconciliation takes the same key exclusively before its compatibility-table lock.
- Evidence and workflow commands lock non-null authenticated members `FOR KEY SHARE` before child, revision, or check-in rows. Concurrent member deletion therefore waits, then pauses and clears any ownership committed by the writer.
- The membership trigger follows the same shared advisory, child, revision, and check-in order. Its `member_removed` transition is guarded so ordinary SQL and public pause commands cannot manufacture it.
- A member-removed workflow with a linked open conflict remains paused during takeover. Conflict resolution must finish before a new adult can activate the prompt.

### Task 5 exact reconciliation and Auth locking

- Reconciliation exactness includes item, answer, canonical source, and the exact observation timestamp. Same-answer changes to source or `answered_at` append a new reconciliation row, supersede stale legacy rows, and bump the live source revision.
- Member validation locks `auth.users` first and `family_members` second, both `FOR KEY SHARE`. Concurrent Auth deletion now waits behind start, response, and evidence writes instead of creating a cascade and assignment deadlock.
- Conflict rows no longer duplicate evidence actor columns. Evidence A and B remain the single actor source, while `resolved_by_member_user_id` retains the separately validated resolver.
- The disposable PostgreSQL harness covers same-answer new-date and new-source reconciliation, revision bumps, Auth deletion races for start and evidence response, and the absence of redundant conflict actor columns.

## 2026-07-11 Task 6

### Task 6 plan-confirmed

- `manage_child_progress` is the one Eve tool for journal evidence, check-in lifecycle commands, explicit adult handoff, and conflict resolution. Its strict Zod discriminated union rejects family, member, journal item, server prompt item, child-name, adult-name, and journal-answer fields.
- The pure adapter builds service context from `resolveAgentAccess` plus channel-stamped member, message, reply-delivery, and episode attributes. Server time is generated at execution, and every model-supplied child, check-in, and conflict ID remains re-scoped by the services.
- Tool results form one strict card-ready union. Question and conflict payloads omit item IDs, evidence IDs, and raw quotes. Journal activity-only, no-match, ambiguous, and refused outcomes use fixed safe notes.
- Fresh turn context now has a separate historical-data block for active and paused check-ins plus bounded live subject, domain, and topic state. It renders the exact server statement without raw evidence quotes or large serialized projections.
- Web, SMS, and email bind a progress prompt only after a successful durable conversation delivery. Selection requires exactly one active, unbound check-in matching family, nullable recipient, and episode. The strict service bind runs before the revision-keyed reply loop opens.
- Linked-family SMS receives the same check-in routing in one or two sentences, one question per text, and no rich cards. Its branch explicitly refuses signup tools.

### Task 6 discovery

- The existing family check-in list was sufficient for conservative delivery selection, so Task 6 did not add another repository query. Exact recipient and episode filtering happens before the already strict transactional bind.
- Generic reactive question loops can remain unchanged. A successfully bound progress loop replaces the same delivery's generic prompt key through the existing one-loop-per-delivery upsert.
- Delivery-ledger replay can return an already-sent attempt. The web, SMS, and email handlers use that durable attempt to recover a bind if the provider succeeded before a prior callback stopped.
- A callback may also stop after the strict bind but before its reply-loop upsert. A replay now recognizes the one check-in already bound to that exact delivery and idempotently reopens its revision-keyed loop without binding again.
- An already-sent unbound replay must contain the current exact server statement, and the check-in update must predate that delivery's durable `sent_at`. This recovers a post-send crash without binding a newer revision, including a later revision that happens to repeat the same statement.
- Eve's package-boundary build cannot resolve the `server-only` marker used by the Next entry. `runtime.ts` now owns the shared Eve and Next server composition with the pure projection, while `index.ts` remains the guarded Next entry. The Postgres adapter omits only that unsupported marker and remains reachable through server-side `mapDb`.

### Task 6 deviation

1. **What the plan said:** The model-facing pause reason is `explicit_stop`.
2. **What the code revealed:** The existing Task 5 domain type, strict record schema, service, and unapplied SQL contract persist the equivalent pause reason as `explicit_pause`.
3. **Conservative choice:** Keep `explicit_stop` at the requested tool boundary and translate it to `explicit_pause` inside the adapter. This avoids an unnecessary schema rewrite while the migration remains unapplied.
4. **Revisit:** Rename the persisted reason only as one coordinated domain, SQL, compatibility, and rollout change if product language needs the storage value itself.

### Task 6 rollout concern

- The local migration remains unapplied. No remote migration or remote isolation command ran in Task 6. Task 9 writer migration and the recorded rollout sequence still gate feature activation.

### Task 6 local verification

- Strict TDD runs first failed on the missing tool contract, agent context, delivery binding, progress reply contract, linked-SMS guidance, conflict-answer rendering, global context cap, stale-delivery replay guards, and conservative choice-reply attribution. Each focused suite passed after its minimal implementation.
- The complete ChildProgress suite passed 166 tests. The continuity guard passed 71 tests, including natural same-channel choice replies, exact cross-channel answer chips, and unrelated-statement refusal. Map and taxonomy guards passed.
- Workspace typecheck and targeted Task 6 lint passed. The first Eve build exposed the unsupported `server-only` package boundary; the runtime split fixed that root cause, and the repeated Eve build completed successfully.
- The committed disposable PostgreSQL harness passed after the final runtime split. It used only a local temporary cluster and did not contact a remote database.

## 2026-07-11 Task 6 quality closure

### Trusted command and provenance boundary

- Model inputs no longer accept revisions, idempotency keys, or journal text. Check-in, conflict, and undo identifiers are UUID-validated.
- Runtime context now carries Eve session and turn IDs plus bounded canonical inbound text and its durable conversation-message UUID. Operation keys derive from provider message identity or session, turn, and action.
- Web, SMS, and email stamp canonical inbound provenance before tools run. Dispatch, research, and voice cannot use the interactive progress command path.
- Journal matching may inspect the bounded inbound message, but evidence stores only the matcher-returned child-attributed clause, capped at 500 characters. Evidence and check-in responses retain channel and composite-family message provenance.

### Workflow, cards, and context

- Check-in commands lock the current record and use its current revision. The model no longer participates in compare-and-swap.
- Family and progress context render fixed disclaimers followed by bounded `JSON.stringify` output. Adversarial newlines, headings, and instruction-like names remain escaped JSON strings.
- Conflict opening keeps the disputed item current. Fresh context includes conflict ID, canonical skill statement, and both adult answers with names and dates.
- Progress updates expose an evidence UUID undo token. Undo supersedes active family-scoped evidence and refreshes live and compatibility projections in one receipt transaction, while evidence held by an open conflict is refused.
- Conflict results use `Please confirm`, one declarative skill statement, the exact child-specific question, both saved answers, and `ask_later`.

### Prompt delivery and reply safety

- Active prompts persist pending runtime-session and turn markers. Advance, resume, takeover, conflict resolution, and active-start replay refresh those markers; terminal and ordinary pause states clear them.
- Web, SMS, and email bind only the exact family, recipient, episode, runtime session, and turn. Assistant prose is no longer delivery authority.
- Sent and uncertain submissions may bind. Hard failures cannot. Generic reactive loops open only after provider outcome handling and only when no progress loop was bound.
- Resolved loops cannot reopen through upsert replay. The PostgreSQL harness covers reply-before-bind refusal, hard-failure refusal, uncertain binding, resolved replay, exact prompt contracts, evidence provenance, and durable undo.
- Reply classification now separates progress choice language from generic yes/no. Progress matching uses bounded whole-message patterns and rejects subject-changing `instead` sentences.

### Unapplied migration changes

- `child_progress_evidence`: added nullable paired `channel` and `message_id`, composite-family conversation-message foreign key, and message index.
- `progress_check_ins`: added pending runtime-session and turn columns, active/conflict state invariants, member-removal clearing, and a partial pending-prompt lookup index.
- `progress_check_in_responses.inbound_message_id` is now required for canonical interactive provenance.
- `child_progress_operations` now admits the receipt-backed `undone` terminal status.
- The migration remains local and unapplied. No remote database command ran.

### Quality-closure verification

- Red runs failed on each requested boundary: forbidden model ownership, missing canonical provenance, unsafe context interpolation, disputed-item drift, missing undo and card fields, marker mismatch, uncertain and replay delivery behavior, and cross-kind reply capture.
- The final ChildProgress plus family-context run passed 171 tests. Continuity passed 75 tests. Map, taxonomy, workspace typecheck, Eve build, targeted source lint, and the disposable PostgreSQL harness passed.
- The unscoped root lint command traverses ignored deployment output under `apps/web/.vercel/output` and reports generated third-party bundle errors. The targeted lint over every changed source and test file passed with no errors. Generated deployment output was not edited.

## 2026-07-12 Task 6 final delivery and undo closure

### Batch undo

- Every `child_progress_operations` receipt now has its own UUID. Progress cards expose that operation UUID, never an individual evidence UUID.
- Operation undo loads the completed receipt inside the family and child scope, rejects any active evidence held by an open conflict, supersedes every remaining active evidence row, and refreshes all affected live and compatibility topics in one transaction.
- Matched-many journal operations undo as one batch. The new undo receipt remains idempotent and records the source operation UUID plus all superseded evidence and affected items.

### Prompt proof and delivery outcomes

- Runtime session and turn remain the primary prompt identity for every channel.
- SMS and email additionally require terminal delivered text to contain the exact personalized server prompt. Web relies on its structured question card and does not duplicate prompt prose.
- Uncertain and hard-failed deliveries never bind or open a progress loop. The matching unbound workflow moves to `delivery_uncertain` or `delivery_failed`, clears delivery and prompt markers, preserves its item and responses, and resumes only with a fresh marker.
- The real PostgreSQL harness proves uncertain delivery cannot bind, the workflow pauses and resumes, and only a later confirmed sent delivery binds.

### Replies and load-bearing context

- Whole-message `No`, `Nope`, and `No, not yet` are valid progress choice replies. If a yes/no loop and progress choice loop are both open, plain `No` remains ambiguous instead of choosing one.
- Subject-changing and `instead` sentences remain outside progress matching.
- Per-turn progress loading now reads nonterminal check-ins first. Every unique check-in child, including child seven or eight and conflict-paused children, loads before optional family summaries. Required conflict context is retained even when normal view caps trim optional children.

### Additional unapplied migration changes

- `child_progress_operations.id` is a generated UUID primary key with a family lookup index; the existing child, family, and idempotency key remains unique.
- `progress_check_ins.pause_reason` now includes `delivery_uncertain` and `delivery_failed`; ordinary paused-state marker invariants apply.
- The migration remains local and unapplied. No remote schema or data command ran.

### Final-closure verification

- Strict red runs reproduced all five gaps: evidence-scoped undo lacked an operation token, text channels accepted marker-only delivery, uncertain delivery bound instead of pausing, plain negative choice replies missed or selected the wrong loop, and child eight conflict context was skipped by the normal view cap.
- The final ChildProgress and family-context run passed 175 tests. Continuity passed 77 tests. Map, taxonomy, workspace typecheck, Eve build, changed-source lint, and the disposable PostgreSQL harness passed.

## 2026-07-12 Task 7

### Live Progress routes and hierarchy

- `/app` remains the agent-first landing. The sidebar now labels the feature `Progress` and points to `/app/progress`.
- The stable Progress route resolves the validated view-context child first, then the family's first child without requiring a legacy report.
- The child route validates family membership through `getAppData`, reads the current `ChildProgressView`, and renders a new server-component subject, domain, and topic hierarchy. It does not load a report token or reuse `ReportView`.
- The live view shows concrete skill statements, answer and state labels, source context, and dates. Open conflicts show both adult names, saved answers, and dates. Raw evidence quotes, report history, and internal snapshots are not rendered.
- Children without live evidence receive an honest empty state and an `Ask HOMA about {child}` offer without fake zero metrics.

### Flag and rollback behavior

- `HOMA_LIVE_PROGRESS_ENABLED` enables live Progress only for the exact value `true`. The documented default remains off.
- Flag-off Progress routes return to the matching legacy report routes. Flag-on legacy in-app report routes redirect to Progress.
- Child validation and `notFound()` remain outside the live-read catch. A live projection read failure is logged server-side and redirects to the legacy child report with an internal fallback marker, which prevents a redirect loop.
- `/home`, `/app/home`, and `/app/dashboard` now target `/app/progress`; the route-level flag owns rollback behavior.

### Task 7 TDD evidence

- Focused red runs failed on the missing flag and copy modules, the absent Progress child-switch rule and route resolver, the missing legacy fallback guard, the missing Progress component hierarchy, and the missing sidebar active-route helper.
- The final focused green run passed 22 tests covering exact flag parsing, loop-free fallback routing, every subject, topic, and answer label, the empty-state model, focused-child resolution, child switching, sidebar state, the rendered hierarchy, conflict details, and omission of private or historical fields.
- The complete ChildProgress suite passed 186 tests. Map, taxonomy, workspace typecheck, targeted lint, and the Next build with live Progress disabled also passed.
- Eve build was not repeated because Task 7 changed no agent module or import path.

### Task 7 rollout concern

- The migration remains local and unapplied. No remote migration, remote flag change, deployment, or production probe ran during Task 7.
- The remote isolation guard therefore failed only on the eight absent ChildProgress tables and its authenticated migration-presence phase. Applying the migration remotely was deliberately deferred.

## 2026-07-12 Task 7 spec gap closure

### Flag, context, and projection closure

- The exact live Progress flag now gates the model-facing command before authenticated context resolution or any ChildProgress operation. Disabled turns return one strict `kind: "disabled"` result and read no family data.
- The family instruction loader returns an empty progress block without calling check-in or projection dependencies while the flag is unset or false. The existing family and continuity context paths remain independent.
- `ChildProgressView` projection version 2 carries the validated family IANA time zone and a strict safe subject summary. Evidence summaries retain source metadata and observation time. Conflict summaries retain both adult display names and never quotes.
- The Progress UI formats every subject, topic, and conflict date in the view's family time zone. Subject sublines show evidence count, source and date, or both saved conflict answers.

### Durable adult-name snapshot

- The still-unapplied migration adds `adult_display_name_snapshot varchar(120)` to evidence. A private before-insert trigger discards supplied snapshot text and derives the value from the matching family membership.
- Evidence reads prefer the current membership display name, then the saved snapshot. The PostgreSQL harness proves current-name updates, direct membership deletion, and Auth-account deletion while both conflict names remain available.
- No snapshot index was added. The field is display-only and is never filtered, ordered, or joined; the existing member and child-item indexes continue to serve every read predicate.

### Visual and lint closure

- Older information now uses `--pop-navy` on `--info-soft`, measured at 11.36:1. The empty-state action uses `--brand-active` with on-brand text at 6.87:1, a clay-600 hover at 4.77:1, and the existing 44px target.
- The live column now reads `--container-md` instead of repeating its pixel value.
- Web lint ignores generated `.vercel/**` output beside the existing Eve artifact ignores.

### Gap-closure red evidence

- Disabled-result tests first failed because the result union lacked `disabled`, the tool entered context, and progress context dependencies still ran.
- Projection and copy tests first failed on the missing time zone, missing safe subject summaries, UTC date formatting, and absent source labels.
- The PostgreSQL harness first reported the missing 120-character snapshot column and capture trigger.
- Root lint first traversed `.vercel/output`, exhausted the Node heap, and exited 137.

### Gap-closure green evidence

- The focused closure run passed 65 tests. The complete ChildProgress run passed 199 tests.
- Map, taxonomy, workspace typecheck, source lint, root lint, Eve build, the flag-off Next build, and the disposable PostgreSQL harness passed.
- The green root lint no longer traversed `.vercel` output. The source lint run separately covered every changed web source and test file.

### Gap-closure rollout concern

- The migration remains local and unapplied. No remote database, feature flag, deployment, or production state changed during this closure.

## 2026-07-12 Task 7 final delivery gate closure

- The shared post-delivery binder now checks the exact live Progress flag before listing family check-ins. Web, SMS, and email delivery entry points therefore return `status: "disabled"` with zero ChildProgress reads, binds, pauses, or reply-loop writes while dark.
- Dependency-count TDD first observed a successful bind while the flag was unset. The green test covers unset, false, and non-exact values across all three ordinary delivery channels.
- The KidView `See all progress` action now matches the accessible Progress empty-state treatment: brand-active at 6.87:1, clay-600 hover at 4.77:1, on-brand text, and a 44px target.
- Final verification passed 12 focused tests and all 200 ChildProgress tests, plus source and root lint, workspace typecheck, the flag-off Next build, and Eve build.
- No remote state or migration changed during this final closure.

## 2026-07-12 Task 7 final quality closure

- The query-marker report fallback was removed. Flag-on in-app report routes always redirect to live Progress, while a live read failure renders a reassuring unavailable state at the same child Progress URL.
- A legitimate null live view now rebuilds the canonical empty projection from the validated child, birth date, family time zone, and empty evidence. It does not depend on a report token.
- KidView resolves its progress action from the exact flag: every child gets live Progress while enabled, while disabled children get the old full-report action only when a token exists.
- Empty, unavailable, and KidView chat actions use one focused client component. It saves the validated child context before routing to `/app`.
- Conflict answers now show their safe source label beside the family-local date.
- `check:progress-ui` is the canonical focused command. Its contrast checks read the real token values from `apps/web/app/globals.css` instead of copying hex values.
- Red tests observed the stale fallback API, missing recovery state, unconditional KidView action, missing focus adapter, absent conflict sources, and missing focused script before implementation.
- Retry is a client refresh of the current Progress route, not a same-URL link or navigation.
- Final verification passed 10 focused Progress UI tests and all 203 ChildProgress tests, plus map, taxonomy, workspace typecheck, root lint, the flag-off Next build, and Eve build.
- No remote state, migration application, token report, or commit changed.

## 2026-07-12 Task 7 route-policy closure

- One pure exhaustive route policy now owns flag-direction redirects for Progress index, child Progress, report index, and child report. Each redirect destination evaluates to `continue` under the same flag, which proves the policy cannot loop.
- Permanent token reports always continue. Read failures and empty live data remain covered by the separate page-state policy, which never returns a redirect.
- All four in-app route entry points now consume the same tested policy. The permanent token route remains unchanged.
- `check:progress-ui` now includes every focused flag, copy, schema, page-state, kid-action, route, view-context, sidebar, KidView, unavailable, retry, and Progress view policy test. A script-contract test protects that list and the required web tsconfig invocation.
- Red tests first failed on the missing route policy and the incomplete focused script. No remote state or commit changed.
- Final verification passed all 41 focused Progress UI tests and all 207 ChildProgress tests, plus workspace typecheck and root lint.

## 2026-07-12 Task 8

### Strict web chat cards

- Completed `manage_child_progress` results now pass through one fail-closed, client-safe parser. It accepts only `dynamic-tool` parts in `output-available` state, requires the exact tool name and strict card result shape, and drops server identifiers before rendering.
- Update results render a quiet `Progress updated` chip, bounded topic details, and a separate 44px `Undo` action. Undo sends only `Undo that progress update.` through the existing chat send function. The operation UUID never enters card display data, visible text, or accessibility labels.
- Question cards render the exact server statement once, the child and subject context, every tool-provided answer, `Save and stop`, and a quiet composer-focus action. A nested saved update appears before the next question.
- Conflict cards render `Please confirm`, the declarative skill statement, both adult answers, family-local dates when the family time zone is available, the exact server question, and all confirmation options.
- Workflow results render their nested update first, then a quiet paused, saved, or moved chip. Static and archived message views omit handlers, so their controls stay visible and disabled.
- Live card actions use `ChatClient.sendMessage`. A card click during a running turn therefore enters the existing queue instead of starting a parallel request. `manage_child_progress` now reports `updating progress…` while it runs.

### Task 8 TDD evidence

- Parser red first failed because `progress-message-parts.ts` did not exist. The green parser suite covers all four renderable strict result kinds, nested updates, UUID removal, malformed payloads, wrong tools, unfinished states, and non-card outcomes.
- Card red first failed because the three focused components did not exist. The green component suite covers exact answer sends, exact `Save and stop`, composer focus without send, nested update order, both conflict entries and options, family-local dates, 44px targets, and disabled read-only controls.
- Message integration red showed missing cards, missing workflow output, and the generic tool busy label. Chat wiring red showed that live card actions and composer focus were not connected. The focused script red showed that the new suites were absent from `check:progress-ui`.
- `pnpm check:progress-ui` passed 59 tests. The complete ChildProgress suite passed 207 tests. Workspace typecheck, root lint, the flag-off Next build, and the Eve build passed.

### Task 8 test-renderer discovery

1. **What the task said:** Use the existing `react-test-renderer` component-test pattern.
2. **What the code revealed:** The web package does not install `react-test-renderer`, and no repository test imports it. Existing web component tests use `react-dom/server`.
3. **Conservative choice:** Keep the existing zero-dependency test style. Static markup assertions cover rendered accessibility and ordering, while direct inspection of these hook-free component trees invokes button handlers and verifies exact callback text.
4. **Revisit:** Adopt a maintained browser-oriented component harness in one deliberate testing-tool change if client interaction coverage grows beyond these pure cards.

### Task 8 rollout concern

- Feature-flag-off builds still parse historical card output for safe display, while the existing exact server gate prevents fresh progress tool reads or writes.
- A browser fixture route was not added to production code. The synthetic `EveMessage` integration fixture exercises text, memory, material, update, question, and workflow ordering without requiring an authenticated local family.
- No remote database, migration, feature flag, deployment, commit, SMS behavior, or email behavior changed.

## 2026-07-12 Task 8 quality closure

### Stale and one-shot interaction policy

- One pure policy now selects at most one actionable live progress message. A later user message, later read-only progress result, archived message, consumed action key, or older actionable result leaves a card read-only.
- The first send or composer-focus action claims a session-and-message key through a synchronous ref, mirrors the consumed keys into client state, and disables every control in that message on the next render. A new assistant progress card receives a new key and becomes actionable.
- Busy card actions retain the same one-shot key in the existing queue. The pure queue helper rejects a repeated key even if the same event callback runs twice.

### Composer and evidence safety

- Card sends use a distinct text-modality plan. They never clear the current draft or reset its dictation marker. Ordinary composer sends keep their prior clear-and-modality behavior.
- Conflict answers now carry their exhaustive evidence source from stored evidence through the check-in card, strict tool result, client parser, and card view. The card renders `progressSourceLabel(source)` beside the family-local date.
- Chat receives one non-null effective family time zone. Conflict timestamps must be valid offset-bearing ISO instants before parsing, and an invalid family zone renders the fixed `Date unavailable` label instead of falling back to the device zone.

### Shared client boundary

- `tool-result-contract.ts` is the one strict `zod/mini` result contract used by the server tool and browser parser. It bounds every displayed name, statement, topic, and array, and validates UUIDs, source kinds, and calendar-valid offset timestamps.
- The browser parser no longer imports `tool-contract.ts`, `node:crypto`, operation receipts, or server-only modules. A source-boundary test protects the import graph.
- The final built client chunk containing `Progress updated` was 127,010 bytes gzip as a shared Turbopack chunk. Direct inspection found no `node:crypto`, `createHash`, `operation-receipt`, or `server-only` marker. This is a whole shared chunk measurement, not an attributable Task 8 size delta.

### Quality-closure TDD and verification

- Red runs first failed on the missing shared result module, absent conflict sources, permissive dates and text bounds, nullable time zone, duplicated client schema, and server contract duplication.
- Interaction reds first failed on the missing latest-card policy, missing draft-preserving send plan, all-live handler wiring, absent consumed state, and missing real composer focus helper. A separate red proved a repeated one-shot key still needed queue-level deduplication.
- The focused script red failed until every new contract and interaction suite joined `check:progress-ui`.
- Final verification passed 80 focused Progress UI tests, 211 ChildProgress tests, and 77 continuity tests. Workspace typecheck, root lint, the flag-off Next build, and the Eve build passed.
- No remote database, migration, environment, feature flag, deployment, or commit changed.

## 2026-07-12 Task 8 final interaction closure

### Tool-part action identity

- Progress action identity is now the current Eve session plus message ID and source part index. The pure policy walks every live message and every tool part in order, so only the latest actionable `manage_child_progress` result survives.
- A later read-only, malformed, or in-flight progress part invalidates an earlier action, including when both parts belong to the same assistant message.
- Render items retain their source part index and stable message-plus-part key. `MessageView` gives handlers only to the exact matching part, leaving every sibling progress card read-only.

### Accepted-send consumption lifecycle

- Progress actions now move through pending, consumed, and released states. The synchronous pending set blocks repeated clicks before React state settles.
- A card becomes consumed only after the send path returns `sent` or `queued`. A wall rejection removes the pending key immediately, so the card remains retryable.
- Queue entries carry an optional `progressActionKey`. Queue insertion deduplicates that key, removing an entry releases it for retry, and successful immediate sends or queue flushes keep it consumed.
- Composer focus is treated as an accepted card action and consumes only its exact source part.

### Final interaction TDD and verification

- Red tests first exposed message-only action identity, both same-message cards receiving handlers, and a later in-flight part failing to invalidate an earlier card.
- Lifecycle red tests started with no pending-versus-consumed model and proved wall rejection, queue cancellation, immediate send, flush retention, and pre-render repeated clicks were unhandled. A separate focused-script red added the lifecycle suite to the canonical command.
- Final verification passed 88 focused Progress UI tests and 211 ChildProgress tests. Workspace typecheck, root lint, the flag-off Next build, and the Eve build passed.
- No remote database, migration, environment, feature flag, deployment, or commit changed.

## 2026-07-12 Task 9

### Legacy writer inventory

- `lib/map/store.ts` owned checklist saves, answer deletes, report correction
  upserts, the old conversation observation path, and deliberate report
  generation. `lib/map/walk-store.ts` owned taxonomy walk upserts.
- `/api/map/answer`, `/api/map/report/correct`, `/api/map/score`, and
  `/api/map/walk` were the API entry points. Checklist, deep-dive, report
  receipt, and scoring clients called those routes.
- `agent/tools/signup_record_answer.ts` called the same checklist writer for
  unlinked SMS signup. `lib/sms-onboarding.ts` read compatibility answers and
  deliberately generated the initial token report.
- `agent/tools/record_observation.ts` was the only model-facing legacy item ID
  writer. It is now an Eve `disableTool()` sentinel. Agent instructions and
  skills no longer advertise it.
- Repository search found no other product mutation of `child_answers`.
  Child deletion now relies on the table's existing child cascade.

### Adapter and transaction decisions

- `child-progress/legacy-adapters.ts` is the single rollout branch. Flag-off
  saves, deletes, corrections, walk answers, and conversation compatibility
  calls take only the legacy path. Dependency-injected tests prove no
  ChildProgress operation is called.
- Flag-on evidence uses ChildProgress once, while `not_sure` and `skip` remain
  durable selection coverage without becoming evidence. Checklist and
  deep-dive sources stay distinct.
- Report corrections use one ChildProgress transaction and one operation
  receipt. Evidence corrections append and supersede, coverage answers
  supersede without appending, and null answers supersede then delete the
  compatibility row. Any open conflict returns typed `conflict_pending`.
- Compatibility rows are written before the final source revision is loaded,
  so the new `child_answers` revision trigger cannot leave a freshly saved
  live projection stale. The trigger creates no evidence.
- Postgres projection input unions check-in responses with every current
  `child_answers` row. Exact evidence-bearing compatibility rows link to their
  ledger evidence ID, preventing double counting.
- Browser answer attempts retain one client UUID across retry. Unlinked SMS
  signup derives its key from trusted provider identity, then trusted runtime
  session and turn identity when a provider ID is unavailable.

### Final reconciliation and rollback

- `pnpm progress:reconcile` requires an explicit
  `HOMA_PROGRESS_DATABASE_URL`. It takes the migration advisory lock and calls
  the private reconciliation function through direct Postgres. It prints only
  counts, mode, and status. `--dry-run` invokes the real function and rolls the
  transaction back.
- Production order is code deploy with the live flag false, READY plus legacy
  probes, additive migration and initial backfill, final reconciliation, flag
  enablement, then authenticated web, token report, correction, and linked SMS
  probes.
- Rollback is flag-first. Leave the additive tables in place, never install a
  reverse bridge, and reconcile again before a later re-enable.
- Focused reds captured the missing adapter and reconciliation modules,
  unimplemented flag-on evidence, coverage, delete and correction branches,
  timestamp-sensitive retry, stale coverage selection, the absent revision
  trigger, and the missing Postgres selection union before each implementation.
- Final green evidence: 230 focused ChildProgress and adapter tests, 31 map
  guard checks, 36 taxonomy checks, 77 continuity tests, 88 Progress UI tests,
  monorepo typecheck, root lint, the flag-off Next build, the Eve build, and
  the disposable committed PostgreSQL harness.
- Remote isolation remains deferred as requested.
- No remote database, migration, environment, feature flag, deployment, or
  commit changed during Task 9.

## 2026-07-12 Task 9 specification-gap closure

### Family folds

- Every composite ChildProgress foreign key now uses deferred
  `ON UPDATE CASCADE`, including child ownership, conversation provenance,
  evidence supersession, check-in, response, conflict, and snapshot
  dependencies.
- The shared family-fold transaction moves family-scoped conversation rows
  before the child and takes the ChildProgress reconciliation advisory lock.
  `attachAuthUser` now uses that same transaction shape as SMS stub folds.
- The disposable Postgres harness populates all eight ChildProgress tables,
  runs both actual fold paths, and verifies row counts, destination family
  identity, active check-in state, one destination source-revision
  invalidation, dependent provenance identity, and successful source-family
  deletion.

### Walk coverage and retry identity

- Flag-on `onboarding_walk` answers validate against the lightweight progress
  taxonomy. Evidence answers use ChildProgress. `not_sure` and `skip` write
  only compatibility coverage under the shared advisory lock, allowing the
  revision trigger to invalidate live data without creating evidence.
- The five-answer adapter test preserves successful walk progression for every
  answer. The Postgres harness proves non-evidence walk coverage creates no
  evidence and leaves `MapScores` unchanged.
- Checklist and deep-dive components share a ref-backed intent-key policy for
  POST and DELETE. Network failure retains the key, a changed answer or action
  replaces it, and success clears only the matching current intent.
- Telnyx stamps provider-message and inbound-receipt identity for both linked
  and unlinked sessions. SMS signup prefers provider identity, then receipt
  identity, before runtime session fallback. A reclaimed receipt therefore
  keeps the same operation key after session and turn rotation.

### Evidence boundary

- The design rollback text now records that the Eve `record_observation` tool
  is disabled. Flag-off internal compatibility writers remain the rollback.
- All findings above are local repository and disposable-Postgres evidence.
  The migration remains unapplied, the flag remains off, and no production or
  remote-isolation claim is made.

### Gap-closure TDD and verification

- Red runs exposed all 21 composite foreign keys without update cascades,
  `attachAuthUser` escaping the disposable database seam, family-fold source
  revision drift, walk coverage entering anchored correction, unstable undo
  keys, missing unlinked SMS identity, and absent Task 9 audit coverage.
- The final focused run passed 237 tests. Map plus walk-event, taxonomy,
  continuity, events, Progress UI, monorepo typecheck, root lint, the flag-off
  Next build, Eve build, and the disposable Postgres harness also passed.
- `pnpm check:docs -- --allow-open` now reports valid Task 9 manifest coverage
  and valid migration-count evidence. It still fails on unrelated concurrent
  documentation: 14 candidates absent from the first-seen baseline and
  manifest, plus pre-existing absent Higgsfield entries that need terminal
  lifecycle dispositions. The allowed-open summary remains 241 manifest rows
  and 54 claim-ledger rows.
- No remote database, migration, environment, feature flag, deployment,
  isolation probe, or commit changed.

## 2026-07-12 Task 9 seven-issue quality closure

- Batch corrections now tombstone every active same-item evidence row at or
  before the correction cutoff. Tests cover three prior rows, resolved
  conflict history, delete, non-evidence coverage, and one new real correction.
- `map_walk_prompts` is a server-only prompt receipt table. First and next
  cards return a prompt UUID. Consumption locks the exact prompt, stores its
  result, advances once for all five answers, and makes retries replay without
  another progress write, timestamp, or event.
- Walk `not_sure` and `skip` use the prompt receipt plus direct compatibility
  coverage. They tombstone old topic evidence and leave `MapScores` unchanged.
- Child deletion acquires the shared reconciliation lock before its scoped
  delete and family touch. Family folds acquire that lock, then lock source and
  destination family rows in UUID order before stub checks or context merge.
- Checklist and deep-dive requests distinguish network, 408, 429, and 5xx
  retry from permanent 4xx refusal. Report corrections submit immutable
  versioned snapshots, preserving edits made while a request is in flight.
- SMS signup passes trusted SMS channel, canonical message when present, and
  provider message identity into evidence. Confirmed missing auth remains
  anonymous, while auth client and membership lookup failures return explicit
  server errors.
- The disposable Postgres harness now runs real default save, correction, and
  delete adapters before the ChildProgress migration exists. The unused
  `recordObservation` store API has been removed; the unsafe Eve tool remains
  disabled.
- Final verification passed 250 focused tests, the committed Postgres harness,
  map, taxonomy, 83 continuity tests, events, 96 Progress UI tests, monorepo
  typecheck, root lint, the flag-off Next build, and the Eve build.
- No production schema, provider configuration, feature flag, remote data, or
  commit changed.

## 2026-07-12 Task 9 final four-issue closure

- Graph walk no longer opens a nested legacy transaction. The repository
  transaction takes the global lock, optional member lock, child and revision
  locks, then prompt lock before applying progress, consuming the prompt,
  storing its result, and creating the next prompt.
- Prompt receipts now store expected sitting, source revision, and latest item
  observation. One active subject prompt is allowed. Duplicate starts converge,
  exact replay returns stored output, and stale sitting or newer item evidence
  refuses before mutation.
- Fault-injection Postgres tests throw after evidence or coverage and before
  next-prompt insertion. Evidence, compatibility answers, operation receipts,
  prompt consumption, and next prompts all roll back together.
- Family-fold membership is counted only after both family rows are locked in
  UUID order. Tests cover fold-first insertion refusal, membership-first fold
  refusal, concurrent folds, and context preservation.
- Report edit controls are disabled while their immutable snapshot is in
  flight. Checklist and deep-dive clients preserve conflict-pending answers for
  confirmation, clear mismatched idempotency keys, reject permanent 4xx
  responses, and retain keys only for network, 408, 429, and 5xx retry.
- No remote operation, migration application, feature-flag change, provider
  change, commit, or unrelated cleanup occurred.

## 2026-07-12 Task 9 terminal prompt closure

- Prompt receipts now close as `answered`, `expired`, `stale`, or `stopped`.
  Terminal rows retain their safe result for exact replay and no longer occupy
  the one-active-subject slot.
- Starting after expiry, item staleness, or explicit stop creates one fresh
  prompt. Concurrent restarts converge through the partial unique index.
- Walk evidence duplicate replay now checks `duplicate.original.status`.
  Only original `recorded` and `conflict_open` outcomes advance. Original
  `conflict_pending` remains rejected, leaves the prompt active, and emits no
  event or next prompt.
- The Postgres harness covers expiry replacement, stale replacement, stop and
  restart, concurrent restart, conflict refusal, and exact replay.

## 2026-07-12 Task 10

### Plan-confirmed

- All nine approved event names are present in the typed core registry:
  `progress.evidence_recorded`, `progress.checkin_started`,
  `progress.checkin_answered`, `progress.checkin_paused`,
  `progress.checkin_resumed`, `progress.checkin_ended`,
  `progress.conflict_opened`, `progress.conflict_resolved`, and
  `progress.projection_updated`.
- Every progress schema is strict. Event properties exclude quotes, item and
  operation identifiers, messages, adult data, and contact data. Subject and
  domain values are bounded machine identifiers rather than display text.
- Evidence, lifecycle, conflict, walk, correction, undo, and projection events
  are derived only from committed outcomes. Duplicate, replayed, refused, and
  rolled-back outcomes emit nothing. Event failures are caught after the
  product transaction and cannot change its result.
- The root now exposes `check:child-progress`, `check:progress-ui`, and
  `child-progress:e2e`. The old `test:child-progress:postgres` command remains
  available.
- CI keeps every existing gate, adds the two focused guards and disposable
  E2E, pins Ubuntu 24.04, installs PostgreSQL 16, and supplies only the local
  binary path to the ChildProgress harness.
- The founder registry now records `agent-led-live-progress`. Its
  supersession is limited to the default authenticated app-home and dashboard
  surface. Permanent token and share reports remain, and report history stays
  stored.

### Deviation

1. **What the plan said:** Create `scripts/child-progress-e2e.mts` for the
   Task 10 database proof.
2. **What the code revealed:** Task 9 had already built the proven
   `scripts/child-progress-postgres-test.mts` harness with substantially broader
   transaction, race, compatibility, and cleanup coverage.
3. **Conservative choice:** Keep that harness, add only the missing explicit
   cross-family assertions and PII-free PASS markers, and expose
   `child-progress:e2e` as an alias.
4. **Revisit:** Rename the physical file only in a separate mechanical change
   if one filename becomes important to external tooling.

### Deviation

1. **What the plan said:** Place event tests beside
   `packages/core/src/events.ts`.
2. **What the code revealed:** The core package typechecks every file under
   `src` but did not depend on Node test-runner types, so the new test failed
   the workspace typecheck even though it executed successfully through
   `tsx`.
3. **Conservative choice:** Add the existing workspace `@types/node` 22
   development dependency to `@homa/core`, keeping the test colocated and
   typechecked without changing unrelated lockfile resolutions.
4. **Revisit:** If package test volume grows, define one package-level test
   command and test TypeScript configuration rather than adding exclusions.

### Discovery

- Root `CLAUDE.md` is a filesystem alias to `AGENTS.md`, so the canonical
  ChildProgress command and rollout update reaches both without duplicating
  governance text.
- The E2E already covered takeover, conflict replay and resolution, journal
  evidence, partial stop, folds, deletion, walk receipts, tombstones,
  reconciliation, token stability, history stability, and cleanup. Only a
  direct second-family read and write denial plus named PASS markers were
  missing.
- Pinning both the Ubuntu image and PostgreSQL major version removes CI
  dependence on the moving `ubuntu-latest` image and `PATH` discovery.
- The tracked `agent-led-live-progress.html` and
  `anytime-progress-check-ins.html` prototypes were created after the first
  audit snapshot. Task 10 added their immutable baseline and manifest rows and
  linked their surface-policy claims without resolving unrelated prototype
  debt.

### Todo for human

- Keep `HOMA_LIVE_PROGRESS_ENABLED` false and push the repository changes only
  when explicitly authorized.
- Wait for the intended Vercel deployment to become READY, then probe legacy
  onboarding, token reports, and unlinked SMS before touching the database.
- Apply the additive migration and run
  `pnpm progress:reconcile -- --dry-run` with an explicit production database
  URL. Review the PII-free counts, then run the real reconciliation.
- Enable the flag only after reconciliation. Probe authenticated Progress,
  journal updates, one-question check-ins, takeover, conflict resolution,
  corrections, permanent token reports, and linked-family SMS on the deployed
  revision.
- Refresh the production baseline and claim ledger after those external steps.
  None of them occurred during Task 10 repository work.

### Fresh local verification

- `pnpm check:child-progress`: PASS, 254 tests.
- `pnpm check:progress-ui`: PASS, 96 tests.
- `pnpm child-progress:e2e`: PASS, all nine PII-free stage markers including
  cleanup.
- `pnpm check:map`: PASS, all map checks plus 3 walk-event tests.
- `pnpm check:events`: PASS, every registry and emitter parity check.
- `pnpm check:skills-targeting`: PASS, all targeting checks.
- `pnpm check:taxonomy`: PASS, 1,590 topics, 3,221 edges, 102 domains, 183
  clusters, and all 36 integrity checks.
- `pnpm check:continuity`: PASS, 83 tests.
- `pnpm typecheck`: PASS, 4 workspace packages after adding core Node test
  types.
- `pnpm lint`: PASS, 2 linted applications.
- `pnpm build`: PASS, the Next application compiled and generated 63 routes.
- `pnpm --filter web exec eve build`: PASS.
- `node --check scripts/isolation-check.mjs`: PASS without contacting a remote
  database.
- The safe flag-off route and card smoke: PASS, 21 tests without starting a
  server or reading a database.
- `pnpm check:docs -- --allow-open`: FAIL on concurrent documentation-audit
  debt outside Task 10. The final run validated manifest structure, enums,
  lifecycle rules, aliases, migration drift, internal guards, and all 225
  claim-ledger rows. It still found 13 unrelated or concurrent candidates
  absent from the immutable baseline and manifest, plus pre-existing missing
  Higgsfield files that need terminal lifecycle dispositions. The audit still
  has 243 open manifest rows and 53 open claims. No Task 10 document or
  migration claim is newly uncovered.

### What this changes about attempt #2

- Inventory proven harnesses before creating a newly named E2E file. Add a
  command alias when the existing harness already owns the behavior.
- State the local-versus-remote isolation boundary in the task prompt before
  listing verification commands.
- Give every repository test file a typecheck owner at the moment it is added.
- Require named, PII-free stage markers in long synthetic harnesses from the
  first version so coverage is visible without reading thousands of lines.

## 2026-07-12 Task 10 final quality closure

### Plan-confirmed

- One locator now resolves an event dimension from the anchored bank first,
  then from the narrow assessment-only taxonomy export. Taxonomy evidence,
  conflicts, and resolutions retain the canonical subject and domain.
- Projection events require at least one trusted subject. Unknown affected
  items no longer create a zero-subject analytics row.
- The private membership-removal trigger writes one strict
  `progress.checkin_paused` event for every check-in it actually transitions.
  The event and pause share one transaction, so rollback removes both.
- Runtime pause emitters exclude `member_removed`; the database trigger owns
  that transactional seam.
- `check:child-progress` now owns core events, ChildProgress modules, walk
  events, and reconciliation tests. `check:progress-ui` owns TSX message-part
  and card behavior. `check:taxonomy` now runs the narrow progress-export
  tests.

### Deviation

1. **What the plan said:** Put the TSX message-parts test in
   `check:child-progress`.
2. **What the code revealed:** Browser-facing parser and card suites already
   share the web TSX environment and complete interaction contract under
   `check:progress-ui`.
3. **Conservative choice:** Keep lib, core, walk, and reconciliation behavior
   in `check:child-progress`, and keep TSX message parts and cards in
   `check:progress-ui`. A script-contract test prevents future drift.
4. **Revisit:** Split another guard only if test runtime or ownership develops
   a new stable boundary.

### Discovery

- An unchecked `Promise.allSettled` branch concealed a real deadlock in the
  same-item legacy-write race. Locking the family-scoped child in the existing
  pre-migration-safe legacy lookup restores the ChildProgress child-first lock
  order without referencing additive tables before migration.
- Every settled race now passes through one typed helper that throws on any
  rejection. The same-item evidence result is required to be `recorded`.
- The disposable harness now requires `createdb`, bounds process, statement,
  lock, and idle-transaction waits, and proves PostgreSQL stopped plus the
  temporary directory disappeared before printing cleanup PASS.
- The E2E proves Family A materializes and reads taxonomy evidence before both
  the service and repository conceal that child from Family B. It also queries
  the persisted takeover state and response, then proves partial stop keeps
  the linked evidence live.

### TDD evidence

- Taxonomy evidence first failed with `subjects_touched: 0`.
- Taxonomy conflict resolution first failed without subject and domain.
- The focused guard ownership test first failed because reconciliation was not
  in `check:child-progress`.
- The database event test first failed because the harness event table lacked
  the real `name` and `props` contract.
- Rejection-aware race handling exposed the previously swallowed PostgreSQL
  deadlock before the legacy child lock fixed it.

### Fresh local verification at 2026-07-12T10:09:00-04:00

- `pnpm check:child-progress`: PASS, 261 tests.
- `pnpm check:taxonomy`: PASS, all 36 graph checks plus 2 progress metadata
  tests.
- `pnpm check:events`: PASS.
- `pnpm child-progress:e2e`: PASS, 10 PII-free stage markers. The final marker
  printed only after `pg_ctl status` proved the server stopped and filesystem
  access proved the temporary directory was removed.
- `pnpm check:progress-ui`: PASS, 97 tests.
- `pnpm typecheck`: PASS, 4 workspace packages.
- `pnpm lint`: PASS, both linted applications.
- `pnpm build`: PASS, 63 routes generated.
- `pnpm --filter web exec eve build`: PASS.

No remote database, migration application, isolation probe, deployment,
feature flag, provider, commit, or production state changed.

## 2026-07-12 Production rollout

### Plan-confirmed

- Commits `2172e8f` and `635e16f` deployed flag-off first. The replacement
  preview and production deployment reached READY after the obsolete custom
  Eve tool file was removed.
- The additive migration applied transactionally and backfilled 231 evidence
  rows from 231 evidence-bearing compatibility answers.
- Dry-run and committed reconciliation each reported zero inserts and zero
  supersessions.
- Production isolation passed every anonymous, authenticated, cross-family,
  RLS, and ChildProgress constraint probe.
- The Production flag is enabled. Deployment
  `dpl_CVSe24nqdAHa5PdKhJJTUF97XSoS` is READY on `thankshoma.com`.
- Public landing, onboarding, permanent token report, sanitized live read,
  synthetic check-in start and stop, and a temporary authenticated Progress
  page all passed. Synthetic rows and the temporary Auth user were deleted.
- Vercel reported no runtime error clusters after rollout.

### Discovery

- Eve accepts `disableTool()` only for framework-provided tool names. A retired
  custom tool must be removed from `agent/tools/` entirely.
- The production isolation implementation was correct, but its pre-rollout
  fixture still used the earlier check-in and response shape. Updating the
  fixture exposed all final constraints and produced a green remote guard.

### Todo for human

- Send one deliberate linked-family SMS check-in and confirm provider delivery,
  reply binding, and the next prompt. No real family received a test message
  during this rollout.

### What this changes about attempt #2

- Run the Vercel preview before the production promotion even when local Eve
  build is green.
- Keep isolation fixtures versioned with every new required schema field.
- Use a disposable authenticated account for signed-in production probes and
  verify cleanup with aggregate zero-count queries.
