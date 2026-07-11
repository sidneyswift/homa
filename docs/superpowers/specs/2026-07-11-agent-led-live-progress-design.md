# Agent-led live progress

**Status:** Approved by founder feedback on 2026-07-11  
**Prototype:** `docs/homa-planning/plans/2026-07-11-agent-led-live-progress.html`

## Goal

Homa keeps each child's progress current from ordinary parent conversation and structured check-ins. The agent is the preferred interaction surface. The Progress page is a live subject → domain → topic projection, not a collection of old reports.

## Locked product decisions

1. The agent is the preferred surface.
2. Progress is a live current view.
3. Journal observations and structured check-ins both feed progress.
4. Historical snapshots stay in the database for audit and movement. Parents do not navigate stale report pages inside the app.
5. An existing child check-in starts with newly age-relevant items, then subjects with fewer than two real observations, then the oldest evidence.
6. Every accepted evidence-bearing response updates live progress immediately.
7. Stopping early keeps every accepted response and closes or pauses the workflow. It does not trigger a separate publish step.
8. A second adult takes over explicitly. Saved responses and the current prompt remain.
9. Conflicting adult observations are both preserved. Homa asks which answer fits today before changing the effective reading.
10. Parent-facing hierarchy is subject → domain → topic. “Module” is not a fourth progress level.

## Domain model

### ChildProgress

The deep module. It owns:

- Evidence policy: concrete skill evidence versus activity-only context.
- Append-only evidence and supersession.
- Adult attribution.
- Conflict detection and resolution.
- The current subject → domain → topic projection.
- Compatibility writes into `child_answers` and `child_reports`.
- Internal snapshots for audit and movement.

It does not own conversation wording or question pacing.

### ProgressCheckIn

A durable workflow inside ChildProgress. It owns:

- One child and one scope.
- The active adult.
- The current server-selected item and revision.
- Pause, resume, explicit takeover, stop, and completion.
- One response per prompt revision.

It is not the source of progress truth.

### Progress evidence

An immutable, dated statement about one bank item or taxonomy topic:

- Child and family.
- Answer.
- Source and channel.
- Adult attribution.
- Parent quote when available.
- Check-in and message provenance.
- Supersession link for corrections.

`not_sure` and `skip` are check-in responses but are not skill evidence.

### Live progress

A rebuildable read model:

- Child.
- Projected timestamp.
- Subject rows.
- Domain rows.
- Topic rows.
- Current answers, source, date, and conflict state.
- Existing `MapScores` for compatibility and broad subject summaries.

## Evidence policy

Concrete evidence may update progress automatically:

- “Maya read a short chapter book and retold the plot.”
- “He still cannot pedal without help.”
- A direct answer to a server-issued check-in question.

Activity alone does not prove a skill:

- “We read for 30 minutes.”
- “We did math today.”
- “She watched a science video.”

Activity may still feed memories, hours, or the journal. It does not become progress evidence without a concrete capability.

The journal tool never accepts a model-selected item ID. The server matches the quote against reviewed bank content. One strong match records evidence. Ambiguous matches return a clarification request without writing progress.

## Question policy

- The server owns the item ID and prompt revision.
- One prompt asks about one observable ability.
- Bundled bank items are excluded from agent-led check-ins until split.
- A response is valid only for the current recipient-bound prompt and revision.
- `not_sure` and `skip` save coverage without changing the effective skill reading.
- Topic change pauses the check-in. The unrelated message is never consumed as an answer.
- Cross-channel resume loads the same database workflow.

## Persistence

Additive tables:

1. `child_progress_evidence`: append-only evidence ledger.
2. `child_progress_live`: current materialized projection.
3. `progress_check_ins`: workflow aggregate.
4. `progress_check_in_responses`: immutable prompt responses.
5. `child_progress_conflicts`: open and resolved adult conflicts.
6. `child_progress_snapshots`: internal archived projections.

Every table is child-scoped and uses `is_child_family_member(child_id)` RLS. Every query includes an explicit child or family filter. Server-originated channels continue to use authenticated family mappings and family-pinned libraries until M1-02 completes the non-service-role plus `SET LOCAL` work.

## Transaction rules

### Accept evidence

One transaction:

1. Re-scope child to family.
2. Claim idempotency key.
3. Append evidence or supersession.
4. Open a conflict when two adults provide different effective answers.
5. Rebuild live projection.
6. Update `child_progress_live`.
7. Update compatibility `child_answers`.
8. Update compatibility `child_reports` without appending legacy history per response.
9. Touch the family timestamp.

### Respond to check-in

One transaction:

1. Compare-and-swap the expected check-in revision.
2. Verify current recipient and delivery.
3. Insert one response.
4. Promote evidence-bearing answers through ChildProgress.
5. Select and persist the next prompt.

### Open and take over

- Partial unique index permits one active or paused check-in per child.
- A racing open returns the existing workflow.
- Takeover changes the active adult and prompt recipient, increments revision, and preserves responses.

## Compatibility

- `child_answers` remains the latest effective anchored-answer projection.
- `child_reports` remains the latest scored report and permanent token source.
- Existing token routes keep `ReportView`.
- Existing `child_reports.history` remains stored but no longer receives one entry per agent observation.
- New internal snapshots begin with this feature. Lost historical evidence is never fabricated.
- Existing direct writers migrate behind ChildProgress in later tasks.

## Agent behavior

One tool handles evidence and check-ins. The model never supplies:

- `familyId`.
- `memberUserId`.
- A check-in item ID.
- A prompt revision.

Those values come from authenticated channel context or server workflow state.

Web chat renders:

- `Progress updated`.
- `Check-in paused`.
- `Check-in saved`.
- `Check-in moved`.
- `Please confirm`.
- Structured question and conflict cards.

SMS uses one plain-text question per inbound turn. Rich cards remain web-only.

## Progress UI

- `/app` remains the agent-first landing.
- `/app/progress` resolves the focused or first child.
- `/app/[childId]/progress` renders the live hierarchy.
- The sidebar label is “Progress.”
- Legacy in-app report URLs redirect to Progress after rollout.
- `/onboarding/r/[token]` remains the shareable report surface.
- The live Progress page does not render historical report navigation.
- Internal snapshots may power dated movement copy.

## Copy and safety

- HOMA on UI surfaces, Homa in prose and conversation.
- No red, “behind,” sibling comparison, or deficit framing.
- One observable ability per question.
- Concrete skill, source, and date outrank school-category labels.
- Durable updates are visible and correctable.
- Both adult observations remain available during a conflict.

## Events

Register and emit PII-free events:

- `progress.evidence_recorded`
- `progress.checkin_started`
- `progress.checkin_answered`
- `progress.checkin_paused`
- `progress.checkin_resumed`
- `progress.checkin_ended`
- `progress.conflict_opened`
- `progress.conflict_resolved`
- `progress.projection_updated`

No event includes quotes, messages, adult names, email addresses, or phone numbers.

## Rollout

- Additive migration only.
- Local and preview verification first.
- `HOMA_LIVE_PROGRESS_ENABLED` gates new agent and UI entry points.
- Legacy report and `record_observation` paths remain available for rollback.
- Turning the flag off never deletes new tables or evidence.
- Production completion requires READY deployment, migration evidence, authenticated probe, and reconciliation evidence.

## Acceptance criteria

1. A concrete journal statement updates the matching topic and live Progress view.
2. Activity-only journal text does not update a skill.
3. A linked family can start and resume a check-in in web chat and SMS.
4. One check-in response updates live progress without appending a legacy report-history row.
5. Topic change pauses without consuming the message.
6. Second-adult takeover preserves saved responses.
7. Conflicting observations remain stored and show a confirmation question.
8. The Progress page renders subject → domain → topic on phone and desktop.
9. Token report routes still render.
10. RLS and isolation guards deny cross-family access to every new table.
11. Typecheck, lint, map, taxonomy, events, continuity, Eve build, Next build, and new ChildProgress tests pass.
