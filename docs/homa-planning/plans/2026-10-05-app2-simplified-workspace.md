# Homa v2: same abilities, less interface

Date: October 5, 2026. Epic: [#1219](https://github.com/sidneyswift/homa/issues/1219).

This is a developer handoff for the replacement experience being designed in `/app2`, eventually becoming `/app`. The founder approved the intention and requested this epic. The founder selected the adjacent workspace and white/minimal app2 presentation on October 5. Release authorization remains an explicit gate. This document is the shared specification and evidence layer; GitHub issues own status, priority, assignees and ticket-specific acceptance criteria.

## Read this first

Preserve what a parent can accomplish, the records they trust and the controls they need. Reduce the navigation and decisions surrounding that work. A clean screen that requires a parent to ask an AI to open a file, stop a reminder or correct a record has failed this brief.

The five founder requirements are:

1. Fewer places to go.
2. Fewer decisions to make.
3. No loss of control.
4. Easy and intuitive.
5. Simple, clean, minimal and beautiful UI/UX.

The founder selected the beside-chat composition, including a focused phone sheet, and explicitly retained app2’s white, minimal, sans-serif design. Implement that selected shell; detailed calendar and object interactions still follow their ticket acceptance criteria. Preserve existing permissions, billing, child scope, consent and retention policy. The feature inventory is source-backed, not a claim that every flow currently works in production.

## Authority and audited baseline

Read `AGENTS.md`, `BUILD.md`, `docs/homa-planning/13-mr-prd.md` as amended by the founder registry in `docs/homa-planning/journeys/10-reconciliation.md` section 5. UI verification follows `docs/homa-design/SKILL.md`. The `app2-adjacent-white-workspace` founder ruling overrides its mineral/serif styling for app2; preserve the existing white, minimal, sans-serif presentation. Reuse contract controls and accessibility requirements. Reuse the fleet-skill/domain-tool boundary in `docs/homa-planning/15-agentic-architecture.md`; this project is a surface redesign, not permission to create a parallel agent or database.

The inventory was inspected in `codex/gh-1158-generative-workspace`, base `ad7c9f3cabd0f5c4fb848bc3cd82b6ecaf081be3`, with local app2 activity-bubble edits. PR #1215 is an existing dark conversation-rebuild PR, not a deployed capability receipt. `/app2/page.tsx` returns notFound outside development; its durable path requires both conversation flags. The two local flags were off at the audit. Refresh this baseline against implementation main and applicable live configuration before wiring each slice; never copy a preview bypass into shipping code.

Recent source history worth reading: `5649bd55` (conversation rebuild work), `2633ca29` (main integration), `6ad9f6d2` (#1202 co-op/attendance), `f27b2320` (#1142 Hours categories), and `7df600cd` (#1125 current-material print handoff). These establish integration traps and prior repairs, not current production guarantees. No reverted version of this precise full redesign was established by the bounded history pass.

## Shared experience contract

### One conversation, useful work within reach

Chat handles requests, short answers, questions and receipts. Compact objects show the plan, worksheet, progress summary, resource or task and its next useful actions. Expanded views handle week arrangement, documents, evidence and bulk inspection. Use the same domain object and component contract in compact and expanded form.

Selected October 5: desktop work beside the conversation, with a focused phone sheet that leaves the composer and voice Stop reachable. The comparative prototype remains decision evidence; its mineral/serif styling is not the implementation target. Keep a small predictable way to open schedule, saved work, progress and scheduled help, plus occasional account controls. Exact placement, labels and fullscreen behavior are owned by design ticket V2-01.

Opening a view does not authorize a mutation. Homa receives typed selected-object identity, child/date scope and version, not a vague page title. Chat and direct edits must converge on the same durable object. Views need stable deep links; authentication returns to the intended object. Closing an object returns focus and reading position to its opener. The user can dismiss a view without losing the composer or stopping accepted work.

### No loss of control

Direct access must survive a slow or unavailable model: inspect schedule and records, mark supported work complete, correct/remove records, print existing material, pause/stop help, manage family/account/privacy. Ordinary server connectivity is still required for uncached reads and writes; offline UI must not pretend a remote change succeeded.

Consequential changes expose the affected child/object/date/occurrence/version. Preserve applicable approval gates and supported undo. When an effect is irreversible or not undoable, state that before the existing confirmation. Do not add modal confirmations to harmless navigation or every reversible action. A stale card remains readable and cannot repeat an old approval or action.

Family identity comes only from authenticated context. Switching an object, child or adult must not cause a pending response, cached view or late callback to target a different record. Do not use chat history as the only way to retrieve saved work.

### Conversation and voice

Retain the already recorded founder rules: continuous server-owned recording, automatic queued sending/recovery, newest-message entry, and preserving the active reading position when new content arrives. #1182 owns delivery and restoration. The special interpretation of messages delivered days late remains deferred; do not resurrect it as a launch gate.

Show a submitted message and clear its composer immediately, while retaining recoverable submission identity. Routine saving/sending prose stays invisible. Offline or failed delivery must be truthful and recoverable. Activity belongs in one compact bubble below Homa and reflects actual lifecycle progress; never expose private reasoning or invent work. The first assistant content replaces waiting feedback appropriately.

Keep mic on empty input, send for typed input and Stop reachable throughout active voice. Keep the connecting state in the placeholder. Opening a workspace or typing does not intentionally end voice. Real browser permission/background/interruption limits are tested, not promised away. Conversational voice, dictation and lesson recording are different actions with different retention and controls.

### Visual and interaction quality

Use the current Quiet authority contract for color, typography, spacing, geometry, elevation and motion. Do not invent an app2 token system or copy frozen legacy CSS as authority. UI uses the contract's UI typography, readable density and restrained emphasis; an idle viewport should not become a dashboard of equally loud cards.

The reviewed prototype must supply component anatomy and states for compact object, expanded workspace, collection, question/approval, edit form and account sheet. Every implementation handles empty, loading, partial, ready, updating, failed, stale, offline, unavailable and denied states where applicable. Error recovery belongs near its object; focus and copy explain the next useful action.

Maintain current conversation choices: user right, assistant left, no redundant speaker names, smaller readable text, compact stable Homa, soft feed fades that do not mask buttons, and a short composer. No oversized generic status boxes or duplicate activity messages. Long titles, multi-page materials, many children and long responses are acceptance fixtures, not post-launch polish.

Critical paths must work at 320px width, 200% text, with a phone keyboard, keyboard-only navigation, screen readers and reduced motion. Respect accessible target sizes from the contract and focus visibility; provide non-drag alternatives. Use meaningful accessible names and restrained live-region announcements. Modals/sheets manage focus without stranding users or trapping the voice Stop control.

### Performance and observability

Proposed acceptance target: visible local submission in the next paint and within 100ms on the agreed reference device. Measure UI acknowledgement separately from server acceptance and first real model response. New workspace navigation acknowledges immediately and loads deterministically without waiting for an agent. Baseline app1 and app2 on the same device/network and record p50/p95; do not invent unmeasured response-time promises.

Use existing telemetry/events where possible. Measure request duplicates, failed writes, restoration failures, task completion, navigation actions, cancellations and retries using IDs and timings without transcript or family-content logging. New events use the registry. A rendered status or HTTP 200 is not proof of a durable effect or successful external delivery.

## User journeys and acceptance scenarios

All names and records in prototypes/tests are synthetic. Use a single-parent one-child fixture, a two-child family and a second authorized adult with separate private chat. Assign ticket coverage below and attach actual evidence to the issues.

| Journey | Starting situation and action | Required observable result | Ticket |
|---|---|---|---|
| J01: start and resume | A parent adds two children, starts a check-in, leaves, then returns. | Same family/children and correct unfinished assessment resume; no repeated setup or mixed-child answers. | 10, 14 |
| J02: return to chat | A parent returns after a typed or spoken exchange and refreshes. | Newest content appears with complete history and working artifact references; no manual Save. | 03, #1182 |
| J03: today at a glance | A parent opens today and marks one visible activity done. | One direct completion action, correct child/date, one saved effect and related material still reachable. | 04 |
| J04: rearrange a week | A parent moves three activities while talking, then closes the planner. | Correct dates, clear recurrence scope, conversation/draft/voice preserved and no accidental attended-time entries. | 02, 04 |
| J05: bring in co-op | A parent supplies a program schedule, chooses children and excludes holidays. | Reviewable class/date/duration preview; only approved occurrences are saved. | 05 |
| J06: siblings attend differently | One child attends a class and another is absent; an action is retried. | Only confirmed attendance creates that child's minutes, exactly once. | 05, 06 |
| J07: spontaneous learning | A parent logs learning, then fixes the child or duration. | Targeted correction leaves other activities and sibling records unchanged, with accurate totals. | 05, 06 |
| J08: records in a hurry | The model is unavailable and a parent needs a school-year Hours export. | Direct record review and download still work from stored truth. | 06, 13 |
| J09: make to use | A worksheet is created, revised, printed, reopened next week and restored. | All actions target the selected material/version; durable file and revision history survive. | 07, 08 |
| J10: use owned curriculum | A parent uploads an original, waits for reading, reviews a mapping and approves it. | Source readiness/provenance remains visible; unapproved mapping does not alter the plan. | 08, 09 |
| J11: work takes time | A build continues while a parent leaves; they return, review results and stop it. | Durable actual progress and completed work remain; stop/pause has a truthful bounded effect. | 07, 09 |
| J12: correct progress | A parent checks an ability's source/date and corrects a mistaken observation. | The correct child/evidence is updated; live view and history have honest, distinct meanings. | 10 |
| J13: lesson recovery | Capture is interrupted, analysis fails or the lesson was assigned to the wrong child. | Recoverable upload/retry or explicit supported correction, visible Stop and no silent evidence reassignment. | 11 |
| J14: stop help | A parent reviews a reminder's next run and stops it while Homa is unavailable. | Deterministic control changes the stored schedule; a stale receipt cannot restart it. | 12 |
| J15: paperwork | Required official details are missing, then corrected before document preparation. | Reviewable correct document; no claim of government submission; later retrieval works. | 13, 14 |
| J16: another adult | A co-parent accepts an invite, opens shared work, then membership is removed. | Authorized shared records only; private chats stay private and revoked access clears. | 14, 15 |
| J17: talk while using work | A parent starts voice, opens a worksheet and types a message. | Voice stays active where supported, typed submission works, Stop always remains reachable. | 02, 03, 11 |
| J18: connection loss | Connection fails around submission, then returns; the page may refresh. | Same accepted/request identity is recovered or retried automatically without duplicate effects; actual failures stay visible. | 03, 09, #1182 |
| J19: read older messages | A parent scrolls up as a new reply arrives. | Reading position is preserved with a way to reach latest; next visit opens newest. | 03 |
| J20: model down | A parent opens the week, prints saved work, exports records or changes settings. | Direct controls remain usable without generation; unavailable server/network is represented separately. | 02, 06-09, 12-15 |
| J21: old link | An old material/planner/report/assessment link is opened while signed out. | After auth the intended authorized object/date/child opens; removed objects have safe recovery. | 02, 04, 07, 08, 10, 14 |
| J22: cancel or delete | A parent cancels billing, returns for permitted records, then requests data deletion. | Existing retention/access rules hold and actual deletion clears applicable derived/cached data. | 06, 12, 13, 15 |
| J23: accessible daily use | A parent uses keyboard/screen reader, enlarged text, phone keyboard or reduced motion. | Complete/send/move/print/stop/correct/account actions remain operable and understandable without clipping. | All UI tickets, 16 |

## Finding-unknowns results

Applied the repository skill's blindspot pass against source, flags and bounded history. Count: **5 landmines, 2 unwritten integration conventions, 2 missing concept distinctions**. These are design/integration risks from the audited source, not newly verified production incidents. Existing bug issues retain urgency and ownership.

| Type / trap and evidence | Why it bites and how a shallow test misses it | Copyable implementation constraint / owner |
|---|---|---|
| Landmine: development preview masquerades as shipping behavior. `app2/page.tsx`, localApp2 voice path, PR #1215 flags/database switch. | Local microphone and chat can work while production route is 404 or billing/gates differ. A preview smoke test never exercises the shipping path. | Test the actual production gate/entitlement matrix. Do not lift dev bypasses into /app. V2-03, 15, 16. |
| Landmine: rendering a card is not restoring its action. `app/message-parts.tsx`, app2's missing active IDs/callbacks. | A beautiful restored question is inert, or an old answer executes twice; snapshot tests pass. | Preserve stable active-question/action identity and test reload plus repeated/stale answers. V2-03 and #1182. |
| Landmine: original and generated files have different provenance/lifecycles. Library and Binder detail/version components. | A combined list can accidentally apply restore/delete/share rules to the wrong kind; both item cards still render. | Consolidate browsing, not record types; assert source provenance, version and deletion semantics. V2-07/08. |
| Landmine: calendar schedule is not attendance or mastery. `6ad9f6d2`, programs view, Hours and ChildProgress. | A scheduled class can silently inflate sibling hours or progress; happy-path calendar tests miss ledger effects. | Verify planned/attended/completed/evidence records separately, per child and occurrence. V2-04/05/06/10. |
| Landmine: navigation changes can cross private-adult boundaries. shared shell/auth, conversation privacy contract and #1182. | Shared family state can accidentally restore another adult's transcript; a one-user fixture passes. | Test two adults, revocation, cross-family IDs, cached views and late callbacks. V2-02/14/15. |
| Convention: selected object context is load-bearing. app1 contextual entry, planner-canvas and print fix `7df600cd`. | A generic 'this' or Print action targets the previous worksheet or loses child/date; single-object tests pass. | Carry typed object identity/version through opening, chat, printing and returning. Test two same-title objects. V2-02/04/07. |
| Convention: source and local checks are not delivery proof. BUILD.md, dark rebuild PR #1215. | A green unit test proves neither continuous recording nor production/provider behavior. | Attach durable read-back and actual supported-device/live delivery evidence to the appropriate gate. V2-03/11/12/16. |
| Missing concept: voice chat, dictation and lesson recording are different. VoiceMode, web recorder, lesson-recording skill's iOS handoff. | Reusing one mic action can imply capture/retention or unsupported background behavior. | Make intent and Stop explicit; test each supported browser/platform and preserve consent/retention. V2-03/11. |
| Missing concept: a school activity, recurring Homa help and a finite build are not one task type. planner, tasks, agent-job-overlay. | One generic Stop/Done action can cancel the wrong kind of work or lose partial results. | Preserve domain-specific effects behind a simple common entry. Test return/pause/cancel/partial output. V2-04/09/12. |

### What remains to learn, with an owner and a stop point

| Question | Current working assumption, not a new ruling | Resolution |
|---|---|---|
| Inline planner or side workspace; where does navigation live? | Resolved October 5: beside the chat, white and minimal. | V2-01 comparison and explicit founder selection authorize V2-02 wiring. Final navigation and domain interactions retain their acceptance gates. |
| What feels too dense on a real phone, especially with several children? | Details on demand, child scope visible at actions. | V2-01 uses real-size synthetic long-content fixtures; V2-16 validates accessibility and task completion. |
| What happens to half-edited forms when closing or switching an object? | Preserve drafts where safe; confirm only actual loss or irreversible effects. | V2-01 defines per-form close rules; V2-02 implements and domain tickets test them. |
| Do all existing voice, persistence, provider and privacy paths work in the shipping environment? | Current code alone cannot answer. | #1182 plus V2-03/11/15/16 produce explicit evidence. Existing related issues stay linked; failures cannot be waived by this epic. |
| What is the first rollout cohort and when does /app switch? | Dark/opt-in first; no automatic switch from adding the new shell. | V2-16 owns readiness evidence and a founder release decision. |
| Does consolidation require new sharing/retention/full-year policy? | No. Preserve current supported policy and disclose unsupported actions. | V2-09/15 route real changes to existing founder decisions such as #1108; unrelated policy questions do not block existing supported paths. |

### Copyable implementation work order

1. Read this spec, your ticket, current source and the selected V2-01 interaction design. Recheck the audited baseline and applicable flags.
2. Preserve the named outcomes and domain distinctions. Inventory existing components, fleet skills and narrow tools before adding any effect.
3. Declare the object identity, child/adult scope, mutation/retry rules, close behavior, loading/failure states and direct model-independent controls.
4. Implement one bounded vertical slice, reusing domain truth and obeying the current design contract. Keep other unfinished tickets explicit.
5. Run the slice's positive, failure, stale/retry, privacy and accessibility journeys; capture visual evidence and durable read-back where effects occur.
6. Stop at a concrete reviewable preview for design deviations or policy conflicts; record a founder ruling before changing policy. Do not silently choose a new policy to unblock code.
7. Follow the epic rollout ticket for activation. A merged or dark-deployed slice is not permission to replace /app.

## Scope disposition

Preserve all 22 capability groups in the inventory below. Deliberately change presentation: consolidate Calendar/Hours in the existing Planner model, Library/Binder in one browsing experience, live progress/historical reports behind one entry, and repetitive detail routes into contextual workspaces. Preserve the distinctions within those views.

Drop as mandatory UI: permanent feature sidebar, separate voice-mode selection, redundant speaker/status labels, developer/provider controls and old generic starter chips. Preserve direct access and failure information those surfaces once supplied. No new child account/chat, native-only parity, government filing, new pricing, new general data-export format, folder system or replacement task backend is included.

Related existing work is not duplicated: #1158 discovery; #1182 continuity; #1171 send preparation latency; #1196 sign-out; #1101/#1102 source/material quality; #1098/#1099/#1100 progress; #1090/#1093 Hours; #1203 historical co-op verification; #1108 full-year policy; #530 collections; #1016/#1017 planner enhancements; #1212 provider access. Existing production defects are not deferred by this roadmap.

## Shared definition of done

- The ticket's story and mapped journeys work through the selected design with actual data bindings. Attach screenshot/interaction evidence for empty, realistic populated and failure states at phone and desktop sizes.
- Reuse the current canonical domain APIs, authenticated family scoping and exact writes. Introduce no new tool where a fleet skill or UI adapter suffices. Model judgment remains separate from deterministic validation.
- Tests cover meaningful failures at the changed layer: repeated request, stale object/version, wrong child/family/adult, failed write/provider and interrupted navigation as applicable. Synthetic fixture success and real supported-device proof are labeled separately.
- Run affected checks from current CI and BUILD.md. For query/schema changes run isolation first; for migrations run unique-version guard first. For relevant changes run continuity, ChildProgress/progress, design-contract/parity, fleet-skill routing/evals and agent build gates. Do not run production-writing evals as a convenience.
- Visual/copy/accessibility review follows the Homa design workflow, including independent critique where required. Resolve clipping, oversized status treatments, inaccessible actions, duplicated controls and lost focus before declaring polish complete.
- Issue has named owner, PR, acceptance evidence and approved deviations. No unresolved work exists only in a document. Local, tested, merged, deployed and live are separately reported; release follows V2-16.

## Work order and issue index

V2-01 is the initial design gate. V2-02 establishes the shared object/shell seam. V2-03 and #1182 establish conversation/action reliability. Domain slices can then proceed according to the explicit dependency graph, with adapters designed early but final visual wiring gated by V2-01. V2-16 is the final integration/rollout gate. There is no estimate or calendar commitment until owners size the slices.

The numbered rows below are stable spec references, not a second status tracker. Follow each linked issue for its acceptance checklist and current owner/status.


| Work item | User story | Depends on |
|---|---|---|
| V2-01: [#1220 Approve the minimal workspace interaction design](https://github.com/sidneyswift/homa/issues/1220) | As a parent, I can find my week and saved work without learning a new system or asking Homa how to navigate. | Prior discovery #1158 |
| V2-02: [#1221 Build the shared chat and expandable workspace shell](https://github.com/sidneyswift/homa/issues/1221) | As a parent, I can open useful work beside my conversation and return without losing what I was saying or editing. | #1220 |
| V2-03: [#1222 Complete chat, voice, attachments and interactive response controls](https://github.com/sidneyswift/homa/issues/1222) | As a parent, my message appears immediately, I can speak or type while work continues, and every question or result in the chat actually works. | #1221, #1182 |
| V2-04: [#1223 Bring editable planning and family events into the workspace](https://github.com/sidneyswift/homa/issues/1223) | As a parent, I can see today, arrange the week and change an appointment while keeping Homa in the conversation. | #1221, #1222 |
| V2-05: [#1224 Preserve co-op schedules and child-specific attendance](https://github.com/sidneyswift/homa/issues/1224) | As a parent with multiple children, I can schedule co-op once and record who actually attended without creating incorrect hours. | #1223 |
| V2-06: [#1225 Make learning hours easy to inspect, correct and export](https://github.com/sidneyswift/homa/issues/1225) | As a parent, I can record spontaneous learning and download accurate records without waiting for an AI answer. | #1223 |
| V2-07: [#1226 Create, revise, print and restore materials in context](https://github.com/sidneyswift/homa/issues/1226) | As a parent, I can ask for a worksheet, inspect it, change the right version and print it without leaving the conversation. | #1221, #1222 |
| V2-08: [#1227 Unify finding saved work and original resources](https://github.com/sidneyswift/homa/issues/1227) | As a parent, I can find a worksheet or curriculum I already have without remembering whether it lives in Library or Binder. | #1221, #1226 |
| V2-09: [#1228 Make curriculum review and long-running builds controllable](https://github.com/sidneyswift/homa/issues/1228) | As a parent, I can review a curriculum plan before it changes our week, then leave and return while Homa works. | #1222, #1223, #1226, #1227 |
| V2-10: [#1229 Bring progress, check-ins and firsts into one child workspace](https://github.com/sidneyswift/homa/issues/1229) | As a parent, I can understand my child's progress, see why Homa thinks that, and correct it without hunting through reports. | #1221, #1222 |
| V2-11: [#1230 Preserve explicit lesson recording and recoverable review](https://github.com/sidneyswift/homa/issues/1230) | As a parent, I can deliberately record a lesson for the right child and recover the review if upload or analysis fails. | #1221, #1222, #1229 |
| V2-12: [#1231 Make scheduled help discoverable and stoppable](https://github.com/sidneyswift/homa/issues/1231) | As a parent, I can see what Homa will do later, change it or stop it without asking Homa to cooperate. | #1221, #1222 |
| V2-13: [#1232 Preserve state documents and records preparation](https://github.com/sidneyswift/homa/issues/1232) | As a parent, I can prepare and retrieve the school records I need, review the official details and print the correct document. | #1225, #1226, #1227, #1233 |
| V2-14: [#1233 Keep family setup and co-parent access simple and complete](https://github.com/sidneyswift/homa/issues/1233) | As a parent, I can set up my children, update our details and invite another adult while understanding whose information is shared. | #1221 |
| V2-15: [#1234 Preserve privacy, memory, subscription and account controls](https://github.com/sidneyswift/homa/issues/1234) | As a parent, I can inspect what Homa keeps, correct or remove it, manage my plan and leave without losing access the policy promises. | #1221, #1233 |
| V2-16: [#1235 Prove feature parity and roll the workspace into app safely](https://github.com/sidneyswift/homa/issues/1235) | As an existing parent, I can move to the simpler Homa without losing records, familiar links, control or trust. | #1220, #1221, #1222, #1223, #1224, #1225, #1226, #1227, #1228, #1229, #1230, #1231, #1232, #1233, #1234, #1182 |

Existing required dependency: [#1182 conversation restoration and durability](https://github.com/sidneyswift/homa/issues/1182). Its production-bug urgency and scope remain unchanged.

## Capability-to-ticket coverage

| Capability group | Owner ticket(s) |
|---|---|
| 01 Conversation | #1222 |
| 02 Voice | #1222 |
| 03 Attachments | #1222 |
| 04 Planning | #1223 |
| 05 Calendar | #1223 |
| 06 Co-op | #1224 |
| 07 Hours | #1225 |
| 08 Material creation | #1226 |
| 09 Created-material lifecycle | #1226, #1227 |
| 10 Original resources | #1227 |
| 11 Curriculum and builds | #1228 |
| 12 Progress and assessments | #1229 |
| 13 Firsts | #1229 |
| 14 Lesson recording | #1230 |
| 15 Recurring help | #1231 |
| 16 Research/recall/sources | #1222, #1226, #1227 |
| 17 State records | #1232 |
| 18 Family/children | #1233 |
| 19 Adults/identity | #1233, #1234 |
| 20 Memory/privacy | #1234 |
| 21 Subscription/access | #1234 |
| 22 Interactive controls | #1221, #1222 |

## Audited feature inventory and source map

The following inventory is preserved as the October 5 source audit. Its presentation proposals are options for V2-01, not separate approved layouts. Where it says a capability exists, read that as source evidence subject to flags, provider availability and live verification. The shared contract and linked issues above define the implementation work.

## Capability inventory

### 1. One ongoing conversation

Preserve text requests, streamed answers, earlier history, shared family context, private adult conversation boundaries, saved drafts, files attached to messages, clear failed-send recovery, reconnecting, and returning to the newest message. Preserve reading older messages without being pulled down by a new reply.

App1 also has mid-reply message queuing, stopping a text response, and recovery after interrupted streams. App2's currently enabled text path lacks that full lifecycle. The newer app2 recording/request path is present but both enabling flags were false in the local environment at audit time. Continuous automatic server recording is an existing founder requirement, not a verified completed feature.

Proposal: one conversation, one composer, immediate visible submission, quiet progress beneath Homa, explicit recovery only when something actually fails. Keep recording invisible; never require a Save conversation step.

### 2. Voice and speaking while using the app

Preserve start/stop, microphone and playback controls, text use during voice, visible responses and action results, and supported action undo. The same underlying VoiceMode is reused today. Do not conflate conversational voice, speech-to-text dictation, and a deliberately recorded lesson.

Proposal: mic/stop in the composer, optional dictation under input controls, compact sound controls available when voice is active. Opening a planner or material must not reset the conversation or intentionally stop voice. Verify platform interruptions separately.

### 3. Attachments and capture

Preserve photos, videos, files, camera capture where supported, upload progress, removing a staged file, retrying failed uploads, and source links. An attachment can be used for a question, teaching material, or a saved family resource.

Proposal: one plus menu with clear actions. Keep upload state with the file, not as another generic Homa-thinking paragraph. Filing originals and generating new materials remain different effects.

### 4. Planning learning

Preserve asking for a plan, reviewing and approving a proposed plan, editing existing work, scheduling activities, choosing dates and children, moving/removing work, completing work, and reopening related materials. Preserve whole-family and child-specific views.

Proposal: a compact day/week summary in the chat that expands into an editable planner. Homa can discuss and change the same selected plan. Changes must update the displayed plan, not leave a stale screenshot in the chat.

### 5. Family calendar

Preserve appointments, trips, outings, family/child scope, times, recurring events, and the choice between changing one occurrence and a wider series.

Calendar is already a compatibility route into Planner, not an independent destination to rebuild.

Proposal: family events and schoolwork share a schedule view, with their meaning still distinguishable. A scheduled event does not automatically become completed learning or recorded hours.

### 6. Co-op and recurring programs

Preserve reusable program/class schedules, subjects and durations, child enrollment/selection, date-range scheduling, holiday exclusions, attendance, and recorded time tied to the correct child/class. Preserve editing and reviewing those records.

Proposal: add a schedule by file or conversation, review a structured preview, then confirm. Keep direct attendance controls in the expanded planner. Never require a parent to dictate every repeated class individually.

### 7. Hours and learning records

Preserve logging completed learning without first creating a plan; reviewing dates, children, subjects/categories and durations; totals, corrections and removal; and downloadable records with the existing export controls. Preserve record access when subscription policy permits it after cancellation.

Hours already redirects to a Planner view. Do not recreate it as a second full navigation destination just because a sidebar entry exists.

Proposal: quick receipts in chat, an expandable recorded-time view, and direct correction/export controls. Planned minutes, completed time, and evidence of an ability remain distinct.

### 8. Make teaching materials

Preserve personalized worksheets, activities, flashcards, coloring pages, packets, lesson plans, and images where the existing material workflow supports them. Preserve child/interests/difficulty context, previewing, multi-page inspection, revisions, approval/finalization, and reopening.

Proposal: show the material itself in chat, with the next useful actions. Expand for full-size reading and editing. Homa must know exactly which material 'make this easier' refers to.

### 9. Use and manage created materials

Preserve print/PDF access, supported sharing, searching/filtering saved materials, deletion, versions and restoration, unfinished materials, and saved working plans that can be resumed. These are currently spread across Binder and its overlays/shelves.

Proposal: one accessible saved-work collection, with material details and history disclosed when needed. Do not replace useful files with only text links buried in a long conversation. Printing still requires the existing browser/download handoff; direct silent printer control is not established.

### 10. Family-owned resources

Preserve uploading, finding, filtering, opening, editing metadata, assigning children/subjects, and deleting originals. Preserve using a resource as source material and understanding ingestion/readiness failures.

Proposal: one visible collection can contain both originals and Homa-made work, but labels and actions must keep that difference clear. Original ownership, source citations, and retention/deletion behavior must not be flattened into an indistinguishable file list. This is a presentation proposal, not a database merge.

### 11. Curriculum planning and longer builds

Preserve reading owned curricula, reviewing unit decomposition, approving mapping into the planner, and creating multi-week programs through the existing background-job workflow. Preserve reviewing stages, approving, pausing, resuming, stopping, and accessing work already completed.

Proposal: chat starts the work; a compact persistent work card tracks it; detailed curriculum and schedule review gets an expanded workspace. Do not make all multi-week work a single uninspectable chat answer. Existing plan eligibility still applies.

### 12. Progress and assessments

Preserve selecting the child; subject/domain/topic and ability exploration; current saved readings; check-ins and deeper questions; resuming an assessment; evidence/source/date inspection; correcting observations and resolving differing reports; next-practice guidance and associated lessons/materials. Preserve historical/shareable reports separately from a live current view where currently supported.

Proposal: a focused summary and answerable question cards in the chat, expandable into a child progress view. Keep detailed evidence available. Finishing a worksheet or recording time must not by itself claim mastery, and siblings must not be ranked against each other.

### 13. Milestones and firsts

Preserve the child-specific record of firsts, dates, source context, and links back to progress. This is a useful family outcome even if the current dedicated page is not retained.

Proposal: a section within the child's progress view, with important new firsts appearing naturally in the conversation.

### 14. Lesson recording and review

The web has child-scoped recording/upload and lesson review surfaces, including worksheet photos, transcription/analysis state, retry, and recording retention/deletion controls. Agent-led start-recording handoff is separately scoped to native iOS by its skill; do not infer browser handoff parity from that skill.

Proposal: explicit 'Record a lesson' from the plus menu, a focused recording surface with an unmistakable stop control, then an expandable lesson review. Link observations to their evidence and preserve child attribution/correction. Do not hide prolonged microphone capture behind the normal chat mic.

### 15. Recurring help and reminders

Preserve creating/editing/removing recurring tasks, selected days/time, delivery choice, pause/resume, next-run visibility, prior results, and applicable feedback. Morning briefs and evening check-ins are part of the existing task system, with availability controlled by configuration.

Proposal: a task receipt in chat, and a small 'Scheduled help' collection where every active task can be inspected or stopped. Keep Homa's own jobs distinct from activities on a child's school schedule, even if both are reachable from one compact menu.

### 16. Research and recommendations

Preserve the agent's available research, recall, source-reading and family-relevant briefing abilities. This is primarily an agent capability, not a reason for a new tab. Local provider availability is not guaranteed: a previous app2 test could not fetch a page.

Proposal: concise answers, sources, and useful artifacts in chat; factual activity labels in the Homa bubble. No internal tool names, model choices, or private reasoning in the parent UI.

### 17. State paperwork and records

Preserve access to reviewed state requirements, state packets, applicable filing documents, school-year dates, official filing details, download/print/share handoffs, and previously created records. Existing state-specific eligibility and filing-method rules remain.

Proposal: 'Prepare my records' in conversation, with a reviewable document and direct export. Keep this discoverable from saved work too. Generating paperwork is not filing it with a government office, and neither design promises legal compliance.

### 18. Children and family preferences

Preserve adding children; names, birthdays, photos/consent, interests, family details, location/time zone, homeschool approaches and curricula, school-year start, and family values/preferences. Preserve knowing whether work is for one child or the family.

Proposal: one compact family/profile entry, contextual child selection inside relevant work, and editable detail cards. The global interface can be simpler without silently guessing which child a record belongs to.

### 19. Other adults, channels, and identity

Preserve adult invitations, pending invite management, membership controls, each adult's profile, phone linking/contact settings, sign-in/out, and existing text/email/phone access where available. Keep adult-private chat and shared family records distinct.

Proposal: occasional-use account sheets. Invite acceptance and authenticated links must still open the right record after the route changes. These controls do not belong in the everyday composer but must not depend on asking the model.

### 20. Memory and control over data

Preserve what Homa remembers, recall/forget, inspection and removal of stored memories, family data deletion, and applicable consent boundaries.

Proposal: a clear account entry for memories and privacy, plus conversational corrections with a truthful confirmation of what changed. Never make a clean screen depend on concealing retained data or removing deletion controls.

### 21. Subscription and access

Preserve the current plan, billing management, eligible purchase/upgrade doors, feature limits, and access to retained records under current policy. App2 currently has local-only preview exceptions; those are not replacement product rules.

Proposal: quiet account access and clear paid-action prompts when appropriate. Reuse the real rules rather than reproducing old pricing copy or exposing development exceptions.

### 22. Interactive decisions and safe changes

Across all features, preserve question options, approvals, edits, targeted corrections, supported undo, cancellation, retries, and an honest confirmation of the effect. Disabled historical cards remain readable; a stale button must not repeat a past action.

Proposal: small controls beside the relevant object. A visible date picker or 'Mark done' can be simpler than requiring another AI conversation. Preserve permissions and exact data changes below the interface.

## What can disappear or be consolidated

- The permanent multi-item sidebar, if the replacement still gives predictable direct access to saved work, schedule, progress, ongoing help, and account.
- Separate top-level Calendar and Hours doors. They already resolve to Planner views.
- A mandatory voice/text selection screen, Start screen, and routine welcome text. The existing app2 choices already reject these.
- Separate page-sized shells for every detail, checklist, result, or question. Reuse a small set of inline cards and expandable work views.
- The visible Library/Binder split as two required destinations, subject to keeping originals and created work clearly distinguishable inside a combined collection.
- Separate 'report' and 'progress' navigation that makes parents infer which to choose. One progress entry can expose current information and historical/shareable reports.
- Persistent voice-connected text, routine saving/sending messages, developer controls, internal reasoning/tool names, and repeated status blocks. Keep actual errors and an accessible microphone state.
- Duplicated child selectors on every screen. Show child scope where it changes the meaning of an action.
- Generic starter chips as a parity requirement. App1's README explicitly says webchat prompt suggestions are paused pending redesign.
- Debug and operator features, evaluation controls, provider/model settings, dormant skill administration, and unrelated native-only features. They are not family-facing web parity requirements.

Do not remove these outcomes merely to reduce visible controls: inspect records without a model call, print/export, pause/cancel, correct/delete, choose a child, inspect sources, recover work, and manage access/privacy.

## Recommended interaction structure, still a proposal

1. Chat handles requests, short answers, questions, receipts, and quick actions.
2. The selected object appears inline: a plan, material, lesson, progress summary, saved resource, or task.
3. Expand opens that same object beside chat on desktop and in a full-height sheet on a phone. Large calendars/documents can use a wider view. Closing it returns to the same conversation and preserves unfinished edits according to explicit close behavior.
4. Homa receives the actual selected object identity, so 'move this' or 'change that worksheet' refers to the right thing. Opening a view is not itself authorization to change data.
5. A small, predictable workspace entry opens schedule, saved work, progress, and scheduled help without requiring a prompt. An account entry houses occasional settings. Exact menu placement remains unresolved.
6. Preserve deep links and bookmarks, even if old routes redirect to the new object view. Direct access after sign-in is part of functionality.

For Planner, test two compositions with the same task: an inline expandable week and a side workspace. The first is strongest for checking today or moving one activity. The second is stronger for arranging a whole week while talking to Homa. Both can expose the same underlying plan; we do not need two planner implementations. The founder selected the side workspace on October 5; keep this comparison as the design rationale.

## Journeys that determine whether simplification actually works

- A new parent adds two children and completes only part of an assessment, leaves, and resumes.
- A returning parent opens the newest conversation without losing older messages.
- A parent asks what is happening today and completes one activity in one tap.
- A parent moves several activities across a week while discussing the changes.
- A co-op schedule is uploaded, assigned to different children, and scheduled with holidays excluded.
- One child attends while another is absent; only confirmed attendance becomes recorded time.
- A parent reports unplanned learning, then corrects the duration or child without disturbing other records.
- A parent reviews and downloads a school-year hours record without asking Homa to regenerate it.
- A worksheet is created, revised, printed, reopened next week, and restored to an earlier version.
- An owned curriculum is uploaded, read, mapped into lessons, and reviewed before adding work to the plan.
- A multi-week build continues while the parent does other work; they return, inspect, approve, pause, or cancel.
- A parent adds progress evidence, inspects its source, and corrects a mistaken observation.
- A recorded lesson has a failed analysis or wrong child attribution and can be recovered or corrected.
- A reminder is scheduled, its next occurrence is inspected, and it can be stopped without a model reply.
- A parent prepares state records with missing official details and can review the result before external use.
- A co-parent joins and sees authorized shared records without inheriting another adult's private chat.
- A voice conversation remains active while the parent opens a worksheet or types; Stop stays available.
- A submitted request loses connectivity, returns automatically after reconnection, and never causes a duplicate action.
- A parent reviews history while a new reply arrives; it does not steal their reading position.
- A slow or unavailable model does not block opening saved materials, looking at the week, or using account controls.
- An old link to a material, assessment, report, or planner date still opens the right place after sign-in.
- A parent cancels a subscription, accesses retained records according to policy, and can inspect/delete their data.
- The same critical actions work with a keyboard, screen reader, enlarged text, and reduced motion.

## Current app2 gaps to close as part of this redesign

Shared agent access is not enough for parity. Current app2 opens Planner in app1, drops its child-open signal, omits active-card identifiers/callbacks for several shared response cards, has empty child/skill slash lists, does not carry app1's contextual material/plan/assessment entry points, and lacks app1's full active-session recovery/queue controls in its currently enabled path. Fix those outcomes through the new interaction model rather than blindly copying the old shell. Continuous recording remains an acceptance requirement to prove.

## Source map

Paths below are relative to the audited worktree. These are evidence for repository behavior, not deployment receipts.

- Navigation and family scope: `apps/web/components/dashboard/sidebar-nav.tsx`, `context-switcher.tsx`, `account-menu.tsx`; `apps/web/app/app/layout.tsx`.
- Chat, contextual starts, queuing/recovery and interactive cards: `apps/web/app/app/page.tsx`, `chat-client.tsx`, `message-parts.tsx`, `chat-attachments.tsx`, `voice-mode.tsx`.
- Planning: `apps/web/app/app/planner/unified-planner-view.tsx`, `programs/programs-view.tsx`; `apps/web/app/app/calendar/page.tsx`, `hours/page.tsx`, `hours/hours-view.tsx`, `hours/hours-record-export.tsx`.
- Created work: `apps/web/app/app/binder/binder-view.tsx`, `material-detail-overlay.tsx`, `version-rail.tsx`, `working-plan-shelf.tsx`, `in-progress-shelf.tsx`.
- Originals: `apps/web/app/app/library/library-view.tsx`, `library-detail-panel.tsx`.
- Progress: `apps/web/components/progress/progress-view.tsx`, `progress-topic-row.tsx`, `provenance-body.tsx`, `abilities-explorer.tsx`, `firsts-page.tsx`, `lessons-card.tsx`.
- Lesson recording: `apps/web/app/app/[childId]/lessons/record/recorder.tsx`, `apps/web/app/app/lessons/[lessonId]/page.tsx`, `review-client.tsx`.
- Scheduled help/builds: `apps/web/app/app/tasks/tasks-view.tsx`, `task-form.tsx`, `task-history.tsx`, `agent-job-overlay.tsx`.
- State records: `apps/web/app/app/binder/state-pack-card.tsx`, `state-filing-card.tsx`.
- Family and account: `apps/web/app/app/settings/page.tsx` and its sections; `apps/web/components/dashboard/memories-card.tsx`.
- Agent capabilities: `apps/web/agent/skills/` packages for planner, hours-records, family-librarian, materials-studio, curriculum-studio, curriculum-mapping, progress, lesson-recording, and state-records; narrow tools in `apps/web/agent/tools/`.
- Product policy: `docs/homa-planning/13-mr-prd.md` as amended by `docs/homa-planning/journeys/10-reconciliation.md` §5.
- App2 integration and feature gates: `apps/web/app/app2/page.tsx`, `conversation-controls-preview.tsx`, `use-workspace-chat.ts`.

Expandable work now lives beside the chat, with a focused phone sheet. Preserve this capability checklist in that selected composition. Do not silently decide that a feature is unnecessary merely because its current screen is awkward.
