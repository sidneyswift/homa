# September 5 co-founder feedback: verified journeys and implementation scope

Prepared and reverified September 6, 2026. Owner: Sidney. Review and coordination issue: [#1087](https://github.com/sidneyswift/homa/issues/1087).

**The requested outcome:** make Homa dependable with the work these families already do. Record each real learning activity, let the parent correct it where she sees it, make progress questions reveal useful evidence, use the curriculum she already owns, and create pages she can teach from.

**Authorization:** Sidney has now asked for the complete audit, an updated list, GitHub issues for all work that can be completed, then branches, implementation, tests, evals, PRs and merging completed work to main. He also authorized synthetic activities, hours, plans and events for UI testing in the signed-in account. That account was verified as a sandbox family. Routine implementation choices below do not require another approval. Unchosen concepts such as recurring assessment cadence, full-year scheduling and a narrower native product remain explicit decisions rather than assumed requirements.

**Platform and meaning:** Carolyng's operational requests concern the **mobile website**. Discussion of an app with fewer focused features concerns the **native app**. Sidney clarified that “months back” means a comparison such as “15 months ahead” of national benchmarks. Restoring that concept on web is authorized; it does not authorize changing the scorer or adding native comparison pills.

This document holds intent, evidence and acceptance criteria. GitHub Issues hold live status, priority and ownership. F01-F26 are reading references, not a second tracker. “Implement now” means a bounded authorized slice, not a measured delivery-time promise or a claim that it has shipped.

Each repaired item leads with its current implementation receipt and links to the evidence. Sections labeled audit baseline describe behavior before that repair. The ticket index distinguishes shipped repairs from work still being implemented.

## Sources and verification standard

- **P: Homa planner feedback**, September 5. [Original transcript](/Users/sidneyswift/.codex/attachments/e6287453-0982-40f4-87d3-868a8c131303/pasted-text.txt). Line references use this file.
- **R: Progress report issues**, September 5. [Original transcript](/Users/sidneyswift/.codex/attachments/91b92cfb-992c-43a0-a02b-75cb3e52f54b/pasted-text.txt).
- **B: Binder organization: delete options**, September 5, pasted into this task. Delete was requested, discovered by sideways scrolling, then appeared to work; the child switcher was also discovered and worked.

Speaker letters are anonymous and are not used to infer identities. Sidney's clarifications establish platform scope and numeric meaning. Database timestamps are UTC. The September 5 01:22-01:29 UTC motor conversation occurred September 4 in New York time.

Each item below compares the parent's expectation with the active entry, decisions, reads, writes, visible result and stops. **Live** means a browser observation or inspected production record/receipt. **Code** means the deployed implementation was traced. **Replayed** means the actual function or handler ran locally against specified data. **Unknown** means the remaining outcome has not been established. Passing a helper test, seeing a control, or receiving a friendly save message does not certify the complete journey.

The meetings contain unresolved choices: immediate progress probing versus excessive questions across three children; weekly, fortnightly, monthly or quarterly review; a focused native first value versus the broader assistant; and full-year curriculum scheduling. They do not instruct removal of Library, replacement of families' curricula, a pricing change, or automatic printer delivery.

## Production baseline and actual verification

| Evidence | Observation and limit |
|---|---|
| Git | Primary `main` and `origin/main` were `1489c94f32ee20bfa1e97d3bcd53e749115ff58e`, clean at audit start. `git pull origin main` reported already up to date. |
| Deployed web source | Fresh scoped Vercel inspection tied `thankshoma.com` to READY deployment `dpl_HsiDZTZGnU4WHPiRxdzxWaNgjK3t`, September 3 source `21b5ef4ac3bbaf57237488639c9486955c9d7757`. Only four native files differ from the inspected main; the web/agent paths below match deployment. This does not identify the installed native version. |
| Applied database behavior | Custom labels under any subject and Planner reported-time RPC migrations are applied. The live Hours unique index includes `custom_label` but still confuses equal-duration distinct work with retries. |
| Authenticated mobile-web test | At 390 px, the `dd` child/subject link opened old chat with an empty composer. No assessment response was submitted in that reproduction. |
| Authorized populated test | In the confirmed sandbox family, real chat created completed Avery reading 10 min, Jordan math 15 min, and shared art 5 min activities with linked Hours. Day displayed static, truncated records. Editing reading through the real Hours overlay to 11 min saved and changed displayed total from 30 to 31, but database readback left linked Planner duration at 10 while Hours was 11. This verifies an actual consistency failure, not just a possible risk. |
| Carolyng's records | Read-only inspection covered 198 messages from August 30 through September 6 and corresponding tool/Hours/progress/material records. No Carolyng data was changed. Specific receipts and outcomes appear under the relevant item; raw logs are not copied here. |
| Curriculum | 63 active top-level assets: 61 Ready, two Needs attention. The two September 5 originals are 41.3 and 47.2 MiB and exceed the 32 MiB reader/processor cap. A real reader call returned `not-ready`; no saved decomposition or approval was found. A later authenticated private-Blob read verified 51 and 115 pages respectively, with zero extractable text on every page. Both require scanned-page transcription as well as the byte-limit repair. |
| Progress | Actual motor check-ins completed after one response each. Local comparisons with the dedicated deep-dive selector found relevant unanswered questions. Three later skipping/cutting reports became unscored observations. |
| Binder | Actual component plus production CSS reproduced overflow at 320/375/390 px. Separately, a real deleted revision and actual chain selector reproduce the preceding version becoming eligible again. |
| Voice | The actual web request body was replayed through the actual shared tool route with controlled dependencies. Missing required fields caused refusal with zero agent or persistence calls; a complete positive control reached both. No microphone or real spoken tool action was tested. |
| Handwriting | Actual rejected September 1 name-page previews, saved HTML and font geometry were inspected. The literal D page from the meeting remains unidentified. The actual bad page predates the September 2 structured review checklist. |

Focused deterministic baseline tests passed: **61** across progress selection, claims, next moves, map and sentence output; **123** across scoping, Binder selection, Hours arithmetic, dictation/transcript and chat policies. Additional actual-function replays covered numeric output, duplicate child-name day grouping, scan-without-text reader behavior, deleted-chain selection, voice request handling and font geometry. These establish current behavior and test gaps, not fixes. Product implementation and paid behavioral evals follow this audit.

Remaining physical or end-to-end limits: no installed-native certification, real spoken turn, physical printer output, successful generated owned-lesson journey, or complete-book comprehension has been established. A source-verified defect is labeled as such even when no family incident is matched to it.

## Production defects found in the audit

All failures below were escalated September 6. The discovery evidence is historical; the final column points to the shipped repair or identifies work still open. GitHub remains the live tracker.

| Failure at discovery | Discovery evidence | Tracking | Repair evidence |
|---|---|---|---|
| Recorded-time correction leaves linked Planner duration stale | Real sandbox save: Hours 11, Planner 10 | F01, [#1092](https://github.com/sidneyswift/homa/issues/1092) | FIXED `78f3b4e6`, F01 live receipt |
| Named book details disappear | Two actual source/tool/row comparisons | F02, [#1093](https://github.com/sidneyswift/homa/issues/1093) | Open; escalated September 6 |
| Distinct reading time suppressed | Two separate September 3 30-minute activities collided with an existing literature record; at least 60 minutes absent | F03, [#1090](https://github.com/sidneyswift/homa/issues/1090) | Open; escalated September 6 |
| Child/day aggregation merges equal display names; child totals omit shared records in chat | Actual-function replays and hosted output | F07, [#1095](https://github.com/sidneyswift/homa/issues/1095) | FIXED c3409c10; hosted UI, CSV and packet verified |
| School-year surfaces use different starts | UI July 1, chat/Progress August 1, compliance configured anniversary; real July data exists | F08, [#1096](https://github.com/sidneyswift/homa/issues/1096) | FIXED `b8b79693`, F08 live receipt |
| Second language Hours rejected by an old database constraint | First hosted F08 fixture failed with 23514; both production subject constraints lacked `spanish` | [#1120](https://github.com/sidneyswift/homa/issues/1120) | FIXED against deployed `b8b79693` by exact existing migration, live version `20260906195628`; F08 live receipt |
| Deeper-question intent is lost and chat check-ins stop early | Live navigation, actual responses and selector comparison | F09-F10, [#1088](https://github.com/sidneyswift/homa/issues/1088) | Entry and selector FIXED `8e70c942`; live stop-summary defect escalated September 6, 21:51 UTC |
| Capability follow-ups remain unscored; subsequent advice bypasses verifier | Three actual `no_match` observations, stale cutting evidence, no next-move tool call | F13-F14, [#1099](https://github.com/sidneyswift/homa/issues/1099), [#1100](https://github.com/sidneyswift/homa/issues/1100) | Open; escalated September 6 |
| Accepted curricula cannot be read; blank scan can be reported as read | Two actual over-cap files and local blank-text PDF replay | F16, [#1089](https://github.com/sidneyswift/homa/issues/1089) | FIXED `78466fe6`, F16 recovery receipt |
| Name-tracing geometry is wrong | Actual rejected mixed-case output and measured glyph geometry | F19, [#1094](https://github.com/sidneyswift/homa/issues/1094); related #1080/#1066 | Open; escalated September 6 |
| Binder Delete overflows and old revision can return | Three-width layout reproduction; actual deleted chain plus selector replay | F21, [#1091](https://github.com/sidneyswift/homa/issues/1091) | FIXED `1834875f` and `dce9f1c5`, F21 live receipt |
| Web realtime requests cannot reach family tools | Actual request/route replay rejects missing session and sequence | F23, [#1103](https://github.com/sidneyswift/homa/issues/1103) | Bridge FIXED `df9d5860`, F23 live receipt; physical speech unverified |
| Month preview misses recurring/multi-child calendar conflicts | Active query omits canonical recurrence and child-link expansion | F24, [#1104](https://github.com/sidneyswift/homa/issues/1104) | FIXED `ff3258bf`, F24 live receipt |
| Late report writer can overwrite a newer score revision | Active claim/write query trace; actual PostgreSQL race reproduction | [#1124](https://github.com/sidneyswift/homa/issues/1124) | Local fix verified, not shipped; escalated September 6, 21:57 UTC |
| Print tool promises native sheet on channels without a consumer | Active tool/consumer contract trace | F26, [#1105](https://github.com/sidneyswift/homa/issues/1105) | Open; escalated September 6 |

An issue or merged PR is not a production fix receipt. Each implementation must later record its commit, deployment and live verification. Historical recovery is a separately bounded operation using confirmed source records, never a bulk assumption that every old row is wrong.

## Ticket index

| Ref | Outcome | Authorized scope and tracking |
|---|---|---|
| F01 | Edit Day/Week recorded time with consistent linked data | FIXED and verified live; [#1092](https://github.com/sidneyswift/homa/issues/1092) |
| F02 | Preserve book and lesson identity in notes | Implement now; [#1093](https://github.com/sidneyswift/homa/issues/1093) |
| F03 | Count distinct work while deduplicating true retries | Implement now; [#1090](https://github.com/sidneyswift/homa/issues/1090) |
| F04 | Reuse/filter/subtotal family categories | Implement now; [#1035](https://github.com/sidneyswift/homa/issues/1035) |
| F05 | Familiar subject display names | Implement now; [#1035](https://github.com/sidneyswift/homa/issues/1035) |
| F06 | Child/date-scoped export | Shipped and hosted verified; [#1095](https://github.com/sidneyswift/homa/issues/1095) |
| F07 | Correct recorded days and shared-child scope | Shipped and hosted verified; [#1095](https://github.com/sidneyswift/homa/issues/1095) |
| F08 | One configured school-year window | FIXED and verified live; [#1096](https://github.com/sidneyswift/homa/issues/1096) |
| F09 | Start the selected deeper assessment | Implement now; [#1088](https://github.com/sidneyswift/homa/issues/1088) |
| F10 | Explore demonstrated ability and stop honestly | Implement now; [#1088](https://github.com/sidneyswift/homa/issues/1088) |
| F11 | Restore web months-ahead context | Implement now; [#1097](https://github.com/sidneyswift/homa/issues/1097) |
| F12 | Explain map states, evidence and handoff | Implement now; [#1098](https://github.com/sidneyswift/homa/issues/1098) |
| F13 | Capture contextual ability claims; clarify selectively | Implement now; [#1099](https://github.com/sidneyswift/homa/issues/1099) |
| F14 | Ground one next step in fresh evidence | Implement now; [#1100](https://github.com/sidneyswift/homa/issues/1100) |
| F15 | Periodic reviews or assessment sheets | Decision / experiment; [#1107](https://github.com/sidneyswift/homa/issues/1107) |
| F16 | Read accepted curriculum files | FIXED and recovered; selected-page coverage explicit; [#1089](https://github.com/sidneyswift/homa/issues/1089) |
| F17 | Read and use the correct owned lesson | Implement now; [#1101](https://github.com/sidneyswift/homa/issues/1101) |
| F18 | Connect useful owned resources to a teaching theme | Implement now; [#1102](https://github.com/sidneyswift/homa/issues/1102) |
| F19 | Correct handwriting geometry and review | Implement now; [#1094](https://github.com/sidneyswift/homa/issues/1094) |
| F20 | Respect urgency without sacrificing correctness | Bounded repair now; larger concept deferred; [#1102](https://github.com/sidneyswift/homa/issues/1102), [#1108](https://github.com/sidneyswift/homa/issues/1108) |
| F21 | Visible, persistent removal from Binder | FIXED and verified live; [#1091](https://github.com/sidneyswift/homa/issues/1091) |
| F22 | Make actual child scope visible | FIXED and verified live; [#1106](https://github.com/sidneyswift/homa/issues/1106) |
| F23 | Working voice tools and distinct controls | Bridge FIXED and verified live; physical speech unverified; [#1103](https://github.com/sidneyswift/homa/issues/1103) |
| F24 | Respect existing calendar facts; longer year planning | Recurring conflict repair FIXED; full-year concept deferred; [#1104](https://github.com/sidneyswift/homa/issues/1104), [#1108](https://github.com/sidneyswift/homa/issues/1108) |
| F25 | Choose native first value and rollout | Decision / experiment; [#1053](https://github.com/sidneyswift/homa/issues/1053), [#1045](https://github.com/sidneyswift/homa/issues/1045) |
| F26 | Truthful web/native print handoff | Bounded repair now; larger concept deferred; [#1105](https://github.com/sidneyswift/homa/issues/1105), [#1108](https://github.com/sidneyswift/homa/issues/1108) |

## Concrete fixes and near-term improvements

### F01. Edit recorded time from Day and Week

**Tracking:** [#1092](https://github.com/sidneyswift/homa/issues/1092).

**Expected, P14-20:** tap a day's entry, read the full note, correct it and return to the same view without hunting elsewhere.

**Audit baseline:** Day rendered static rows with truncated notes, and Week had no direct recorded-time editor. The old Hours action updated only `hours_log`. An authorized real sandbox correction from 10 to 11 minutes changed the displayed total but left the linked Planner activity at 10, proving the consistency defect.

**Current chain, FIXED September 6:** [PR #1117](https://github.com/sidneyswift/homa/pull/1117), merge `78f3b4e67f957370c9acecb21250ff68dda76b1d`, is deployed READY at `thankshoma.com`, with its additive migration applied and checked. Day, Week and School hours now open the same [editor](../../../apps/web/app/app/hours/hours-entry-overlay.tsx) with the full saved note and linked context. Authenticated transactional RPCs update the linked activity and all affected Hours together. Subject/time are shared; the selected row's category/note remain separate. Combined Planner detail save is atomic too. Date and child are preserved, not editable fields.

**Verified live:** eight actual edit/delete actions and fourteen rendered states passed **465 assertions**. The deliberately inconsistent shared record reconciled to 17 minutes for the activity and both children; sibling annotations and source provenance stayed intact. Week note-only editing, combined Planner correction to 19, standalone correction/deletion, whole-family correction/deletion and updated selected-child totals all matched exact database snapshots. Deleting linked time retained the finished activities and Planner notes. Root inspected the final mobile-width screenshots; fixture cleanup was verified. [Evidence, screenshots, migration and exact limits](../journeys/evidence/2026-09-06-hours-live-verification.md).

**Acceptance boundaries:** local real-PostgreSQL tests cover stale/foreign/malformed IDs, concurrency and rollback. Actual-component browser tests cover errors, cancellation, pending controls and constrained viewport focus. Hosted proof covers real saves, reads, deletion and refresh. Physical touch/keyboard and native direct writers remain outside this web release's certification. Shared/native compatibility and coarse duplicate identity are explicitly recorded in the [implementation contract](2026-09-06-hours-atomic-editor.md) and [#1090](https://github.com/sidneyswift/homa/issues/1090).

### F02. Keep the details that identify the work

**Tracking:** [#1093](https://github.com/sidneyswift/homa/issues/1093).

**Expected, P18-20:** retain the supplied book title and lesson detail in the saved note, including when minutes arrive in a later message.

**Live evidence:** September 1's earlier message identified *Make Way for Ducklings*, but the later 40-minute Hours note did not retain the book title. On September 4, the Planner title identified the Narnia reading while the linked Hours note used only the current source-quote fragment. These are separate mechanisms; they are not attributed to one summarizer without evidence.

**Active chain:** `log_hours` accepts an optional note up to 200 characters, then its authenticated/pinned writer trims and saves it. It does not itself retrieve earlier work. Planner record, completion and time-change paths compose the note with `plannerHoursNote(sourceQuote)` in [planner-learning-activities.ts](../../../apps/web/lib/planner-learning-activities.ts), taking the first 200 characters and ignoring the existing title/note. The exact current-message quote proves provenance; it does not ensure the saved note identifies the work. A successful receipt confirms the row, not preservation of context.

**Implement now:** retain structured activity title/lesson context in the bounded Hours note, with original source provenance kept separately. Improve the existing Planner/logging procedure to retrieve known prior work when a later duration refers back and preserve identifying detail. Use model judgment for references; do not add semantic regex matching.

**Acceptance/eval:** the two actual patterns, a long title, Unicode, blank note, delayed minutes and ambiguous earlier work. Inspect the durable note and rendered record, not only the reply. Historical repair is limited to rows whose intended detail can be established from source; prevalence and broader recovery remain unmeasured. Tracking: #1093.

### F03. Count distinct activities and deduplicate real retries

**Tracking:** [#1090](https://github.com/sidneyswift/homa/issues/1090).

**Expected, P23-46:** separate language lessons and separate reading activities count even when subject, day and duration match. Repeating one save should still count once.

**Active chain:** [log_hours](../../../apps/web/agent/tools/log_hours.ts), its pinned writer and the live unique index identify a block using family, child, day, subject, minutes and custom label. Note, source message and activity identity do not distinguish it. A matching row or unique violation becomes a successful “already recorded” receipt. Planner has activity-derived identifiers but still encounters this coarse Hours constraint; its transaction can fail despite distinct activity identity. The linked time RPC also treats an unrelated equal-duration block as a collision. The September 2 label migration is applied; it did not solve event identity.

**Live evidence:** two separate September 3 30-minute reading activities for Alma were suppressed against an existing literature-journal row. Original messages, tool receipts and saved rows establish at least 60 missing minutes. Older Portuguese/English examples remain historical leads, not part of this confirmed recovery tally.

**Additional code dependency:** family transfer in `family-fold.ts` deduplicates Hours on an even coarser key that omits custom label, then removes remaining source rows. Replacing the index without updating transfer logic would leave another path capable of losing distinct work.

**Implement now:** authenticate retry identity from the operation/source; use a real linked activity ID when the parent refers to existing work. Subject/duration equality is not activity identity. Keep caller tenancy, idempotency and atomic Planner/Hours writes across web, pinned channels, voice and family transfer. Replace the incompatible constraint with deployment-safe migration sequencing, then recover only confirmed lost records after prevention is verified.

**Acceptance/eval:** two independent equal-duration blocks both land; replay of one operation lands once; an explicit reference to the same Planner activity stays once; different payload under one operation refuses; parallel requests and foreign-child negatives; transfer preserves distinct categories/activities. A real-language eval must distinguish independent reading from curriculum reading and different languages. Tracking: #1090.

### F04. Reusable categories under stable subjects

**Tracking:** [#1035](https://github.com/sidneyswift/homa/issues/1035).

**Expected, P23-57:** choose reusable labels such as Portuguese/Spanish or independent/curriculum reading, then filter and subtotal them without losing the parent subject.

**Active chain:** canonical subject IDs come from the Hours model and are checked by tools/database. Per-entry `customLabel` now works under every subject and is editable as free text. Row display substitutes the custom label for the parent name. There is no category catalog, reusable selector, rename workflow or category subtotal/filter. The `find_hours` read path does not select `custom_label`, so chat cannot account for existing categories. CSV currently collapses parent/category into one Subject cell. Native's missing label editor is outside this mobile-web request.

**Implement now:** family-level reusable labels under canonical subjects, matching existing family-scoped records; expose categories to UI and chat reads, filters and totals, and retain parent plus category in exports. A durable catalog supports rename and unused choices; deriving options only from saved rows would be a partial first slice and must be labeled that way. Child-specific category ownership is an optional later expansion, not a blocker to the family-level implementation.

**Acceptance:** repeated choice and rename, two same-duration languages, unlabeled entries, category totals plus unlabeled equal parent total, no cross-family access, empty/long/duplicate labels and CSV round-trip. Time remains bookkeeping, not mastery. Reuse #1035; #1059 records partial custom-label support.

### F05. Use curriculum-familiar subject names

**Tracking:** [#1035](https://github.com/sidneyswift/homa/issues/1035).

**Expected, P47-57:** Language arts, History and social studies, and Foreign language are easier to recognize than the current labels.

**Active chain:** [hours-view.ts](../../../apps/web/lib/hours-view.ts) displays Reading, Social studies and Second language over stable stored IDs; the language key is `spanish` despite the broader label. The same display helper participates in rows/exports, while agent inputs and constraints use canonical IDs. Changing presentation is not renaming taxonomy or reclassifying historical records.

**Implement now:** update the requested Hours display names consistently across selector, rows, category grouping, totals, read-tool receipts and export headers/values. Keep the canonical IDs and explicit category relationships. Do not imply all reading time maps one-to-one to literacy/writing evidence.

**Acceptance:** old records retain their IDs and totals, renamed labels match across mobile-web views and CSV, custom categories still show their parent, and no progress score changes. This is a bounded display slice, not an unresolved approval question.

### F06. Export one child between chosen dates

**Tracking:** [#1095](https://github.com/sidneyswift/homa/issues/1095).

**Implementation under verification:** the [record contract](2026-09-06-hours-record-scope.md) now traces the proposed child/date/shared preview through the actual export route and repeatable-read database snapshot. Populated local browser tests open both CSV artifacts; real PostgreSQL proves the archive exceeds 3,000 rows without truncation. This is not yet a shipped or hosted verification claim. The active-chain paragraph below is the audit baseline.

**Expected, P58-59:** choose a child and inclusive start/end dates, including a term or school year, without separating siblings afterward.

**Active chain:** Planner's download link is fixed at `/api/hours/export`, even after selecting a child. The [route](../../../apps/web/app/api/hours/export/route.ts) authenticates but consumes no child/date parameters. [hours-export.ts](../../../apps/web/lib/hours-export.ts) reads the whole family without the UI's 3,000-row cap and emits CSV with escaped/formula-protected values, child or Whole family, subject, exact minutes, rounded hours, source and note. No date-range inputs currently feed it. An empty downloaded file is not a meaningful scope test.

**Implement now:** visible owned-child, date and shared-record scope; validated date-only inclusive boundaries; one predicate for preview, totals and download. Preserve full-family/full-history export, distinguish parent subject and category, and include correctly derived recorded-day counts using stable child IDs.

**Acceptance:** populated two-child/shared fixture, invalid/foreign child, reversed or invalid dates, first/last boundary day, timezone, shared inclusion, empty result, more than 3,000 rows, CSV formulas/quotes/Unicode. Open the exported artifact and compare its rows/totals with the requested scope, not just the link URL.

**Release verification, F06-F07:** PR #1122 merged as `c3409c107100fccac162ddcd274f902159abf31d`, required checks passed, the additive summary function is installed, and its production deployment was READY. Six mobile-width previews, four real CSV downloads and the actual eleven-page state packet preserved child/date/shared scope, including 3,007 archive entries and two children with identical names. The exact 33m and 35m child totals each covered two recorded days. The native source update published to the matching production runtime. [Hosted evidence](../journeys/evidence/2026-09-06-hours-hosted-receipt.json) preserves the two local harness failures and independent correction proofs. All test records and twelve artifacts were removed and absence verified; provider cleanup/token drain remains separately pending. No physical printing or installed-device uptake is claimed.

### F07. Count recorded learning days per child

**Tracking:** [#1095](https://github.com/sidneyswift/homa/issues/1095).

**Implementation under verification:** child-ID aggregation and disambiguated labels preserve separate records in real generated PDFs. The fleet procedure now includes shared time for a selected child unless explicitly excluded. The corrected eight-case model matrix, five routing samples, two final full-menu cases and an actual disposable Eve/SQL route passed. The complete reader passes 15 database groups, including more than 4,000 records and all five saved sources. The [record contract](2026-09-06-hours-record-scope.md) distinguishes source versions and local evidence from pending hosted release verification.

**Expected, P60-85:** count each child's school dates separately, including the sick-sibling example, and export a chosen period; several activities on one day count once.

**Active chain:** the [state-pack route](../../../apps/web/app/api/compliance/pack/route.ts) reads family/roster/Hours and configured year, then [pack.ts](../../../apps/web/lib/compliance/pack.ts) matches a row by child ID when present or includes whole-family rows for each child. Its aggregation key and summary lookup then use **display name plus date**, losing distinct child identity. The separate state-records summary counts family-level days. A shared row counts for every child; a missing row says nothing about absence.

**Replayed:** distinct names produce the intended one-day arithmetic. With two distinct children both named Same, separate 20/30-minute first-day records merge to 50 minutes and the shared 10-minute second day is duplicated to 20. Another actual-function comparison gives a selected child 30 minutes in UI for 20 own + 10 shared, but chat's child filter returns 20 because it excludes shared rows. Live prevalence of identical names was not queried; the deterministic defect is established without that assumption.

**Implement now:** group by stable child ID, apply explicit shared inclusion consistently, and expose/export **recorded learning days**. Keep name changes as labels. Do not call missing time an absence or claim a legal attendance total. An untimed day/absence ledger or excluding one child from a shared activity needs a separate contract.

**Acceptance:** duplicate and renamed children, repeat activities/day, shared work, no children, empty window, child/chat/UI/export parity. Regenerate and inspect the actual state-pack PDF after correcting arithmetic. The stronger sick-child attendance outcome is only established where records explicitly identify participants.

### F08. Use one configured school-year window

**FIXED and verified live:** [PR #1119](https://github.com/sidneyswift/homa/pull/1119), main `b8b7969393e9421c36e33e33e623b2ce5a4a5375`. The [live receipt](../journeys/evidence/2026-09-06-school-year-live-verification.md) records 381 passing assertions across real Settings save/clear, nine populated Hours states and the authenticated summary. Configured totals were Avery 22m, Blair 28m, and 45m at family level; clearing restored 63m, 28m and 86m. Week/month remained independent and future records stayed outside current totals. Source-matched Progress/packet reads are separately labeled; no hosted subject-panel, generated PDF or model-conversation claim is implied. The [implementation contract](2026-09-06-configured-school-year.md) retains local edge-case evidence.

The first hosted run also found an unapplied existing Second language subject migration. Root applied and verified it as [#1120](https://github.com/sidneyswift/homa/issues/1120). Two further test-script navigation failures and all four fixture cleanups remain in the evidence. The paragraphs below describe the audit baseline before these repairs.

**Tracking:** [#1096](https://github.com/sidneyswift/homa/issues/1096).

**Expected, P60-98:** the same family's same period should yield the same records and totals everywhere, respecting the saved start date and year-round schooling.

**Active chain:** UI `periodStart(schoolYear)` hardcodes July 1; chat's [hours-summary.ts](../../../apps/web/lib/hours-summary.ts) hardcodes August 1; Progress subject-hour totals reuse the latter. Compliance uses the saved `school_year_start_on` and most recent anniversary, returning no year start when unset. Comments claiming shared conventions are stale. These surfaces therefore do not ask the same database question.

**Verified:** calls for September 6 return July 1 versus August 1. The earlier scoped production audit found 51 July rows across three non-sandbox families, totaling 2,229 minutes, so the disagreement can change real totals.

**Implement now:** one shared date-only resolver using the family's saved start; carry it through UI, chat, Progress and export. Preserve the existing compliance meaning for an unset start: show an honestly labeled all-time total and offer the existing setting rather than invent a school year. No new policy choice is needed to respect the setting or avoid a false period label.

**Acceptance:** anniversary and year rollover, February 29, timezone boundary, missing/invalid start, no future records in a current-period total, and identical UI/chat/Progress/export scope. Tracking: #1096, with F06/F07 dependencies.

### F09-F10. Deeper questions should locate demonstrated ability and update progress

**Tracking:** [#1088](https://github.com/sidneyswift/homa/issues/1088).

**Implementation and current verification:** PRs #1121 and #1123 shipped the selected request, adaptive questions and polling correction. On deployed `8e70c942`, a returning synthetic family received three actual selected-child math questions and saved two canonical answers while its ordinary page preference named the other child. The explicit stop first failed schema validation on an extra parameter, then corrected itself and received `parent_stopped`. Return-to-Progress and reload acceptance remain unverified. Its final prose also changed the saved “by ones or by tens” to “both by ones and tens”; #1088 is reopened for that observed language defect and final live verification. The retained synthetic family was removed through reviewed canonical account deletion on September 6 at 22:00 UTC: all 21 checked database/Auth scopes are empty; deletion job `ead7748b-cf58-42e8-8e73-5cff6209a1eb` retains provider cleanup and token drain until September 7 at 04:30 UTC. The initial failure receipts remain evidence, not passes. A local skill/schema correction now preserves alternatives and publishes the pause-only parameter boundary; nine deterministic tests and both real model checks pass, including the actual disposable-PostgreSQL behavior journey. Hosted return/reload and final summary verification remain pending.

**Release verification update:** the initial implementation is deployed in [PR #1121](https://github.com/sidneyswift/homa/pull/1121), main `325216fa`. A real hosted request reached Avery's selected Math sitting while Blair was the page preference, and saved the exact delivered question. Full acceptance remains open: the browser check exposed a polling restart on same-value server rerenders. That defect has a failing-before/passing-after actual-hook regression and a separate correction branch. The [implementation evidence](2026-09-06-deeper-progress.md#hosted-verification-and-polling-correction) separates this result from the remaining saved-answer/Progress journey. The original audit chain below is historical.


**Heard:** R14-21. The button opens the last chat without a question. After manually requesting an update, Carolyng receives one question and an age-level reassurance. Her stated need is: “I don't want to know if she's on target for a four year old. I want to know where is she?” She gives both harder and easier examples. More questions are a means to discover current ability; a larger fixed question count is not the outcome. The requested months-ahead comparison is a related, separate presentation issue in F11.

**What the button promises:** [ProgressDetailPanel](../../../apps/web/components/progress/progress-detail-panel.tsx) says up to eight questions will sharpen the number and update the progress report. [The tile model](../../../apps/web/lib/child-progress/map-model.ts) offers the action for a mapped, non-exposure-based score; it does not check whether useful questions remain.

**F09, actual entry path:** the detail panel and [full report](../../../apps/web/app/onboarding/r/[token]/report-view.tsx) link to `/onboarding?dd=<child>.<subject>`. [Server onboarding](../../../apps/web/app/onboarding/page.tsx) redirects an already-completed family to `/app`, dropping that intent. The authenticated production reproduction showed the old August 15 chat and an empty composer. There is another bypass: [MapFlow](../../../apps/web/app/onboarding/map-flow.tsx) enters chat before parsing `dd` when chat onboarding is enabled. [The app page](../../../apps/web/app/app/page.tsx) has no `dd` handler. Preserving the query string alone is insufficient.

**F10, two different assessment implementations:**

| Stage | Older dedicated flow behind the `dd` link | Check-in actually started by Carolyng in chat |
|---|---|---|
| Entry | `MapFlow` selects the child/subject and renders [DeepDiveStep](../../../apps/web/app/onboarding/deep-dive-step.tsx), if the earlier chat branches do not intercept it | `manage_child_progress.start_check_in`, purpose `subject_deep_dive`, starts or resumes an authenticated check-in |
| Selection | [nextDeepDiveItem](../../../packages/core/src/map/bank.ts) considers all unanswered items in that subject. It probes near the midpoint between demonstrated ability and a “not yet” answer, or six months above/below the known side when only one exists | [selectNextProgressItem](../../../apps/web/lib/child-progress/check-in-selection.ts) uses the ordinary age-based `planQuestions` and [checklist queue](../../../packages/core/src/map/question-queue.ts). `subject_deep_dive` scopes subjects; it does not select the older deep-dive algorithm |
| Bounds and refresh | Can explore below the age baseline or beyond its two harder rungs. Asks only never-answered items, including treating prior skips as already answered; it does not refresh stale answers | For fine/gross motor and music, base plus at most two harder rungs, with an age-plus-24-month ceiling. Climbing requires “easily.” Can refresh an old eligible answer at the start |
| Stopping | Eight new responses or no unanswered bank items. There is no separate confidence-based completion check | After each response, [check-in service](../../../apps/web/lib/child-progress/check-in-service.ts) disables refresh; no next eligible item marks the check-in completed. A non-easy base stops the climb without looking below it |
| Saving and result | Answers use `/api/map/answer` and the progress adapter. After pending saves succeed, [ScoringStep](../../../apps/web/app/onboarding/scoring-step.tsx) calls `/api/map/score`, then opens the subject plan with `rebuilt=1`; [that page](../../../apps/web/app/onboarding/r/[token]/plan/[subjectId]/page.tsx) rebuilds the four-week plan | A response and its validated progress evidence are recorded through the check-in/progress services. The result contains the saved update, next question or completed state; this path does not navigate through the older scoring/plan screen |

**Actual records and comparison replay:** Amalia was 48 months old. Production response rows and tool receipts show catching a ball, answered “easily,” then completion at 01:22 UTC September 5. Fine motor refreshed pouring, answered “easily,” then completed at 01:25 UTC. A fresh family-scoped read confirmed all seven saved fine/gross-motor bank answers and their timestamps. Running both existing selectors locally against those answers gives:

| Input | Chat selector after response | Older dedicated selector with the same answers |
|---|---|---|
| Actual gross motor after catching; July galloping/hopping/pedaling already “easily” | No next question | Skipping with alternating feet, 68-month bank anchor |
| Actual fine motor after pouring; July beads “easily,” straight-line cutting still “getting there” | No next question | Independent 20-plus-piece puzzle, 70-month bank anchor |
| Synthetic 48-month child whose galloping answer is “not yet” | No next question | Pedaling a tricycle, 44-month bank anchor |

The first two rows are comparisons using actual saved data, not claims that the older screen ran for Carolyng. The third is a synthetic boundary check. Additional local calls verified the older selector returns no question at its eight-response cap or when every bank item is answered. These are selector replays, not new production assessments.

Gross motor's chat window is galloping, hopping and catching. Skipping exists and even fits the 72-month age ceiling; the two-rung slice excludes it. Fine motor's window is pouring, beads and straight-line cutting. Refreshing pouring does not revisit the stale cutting answer. The actual chat reinforces the mismatch: Carolyng explicitly asked for more, reported slow alternating-leg skipping, then explained that suggested straight-line cutting was already easy. Music demonstrated the broken link in the meeting; no completed music check-in was found, so its live session behavior is not claimed reproduced.

**What reaches the report:** [legacy adapters](../../../apps/web/lib/child-progress/legacy-adapters.ts) route real answers into ChildProgress when enabled. [The progress service](../../../apps/web/lib/child-progress/progress-service.ts) appends evidence and refreshes derived progress plus compatibility answers in the transaction. [The projection](../../../apps/web/lib/child-progress/projection.ts) scores effective evidence, and [the Progress page](../../../apps/web/app/app/[childId]/progress/page.tsx) loads that view. A saved answer can legitimately leave the number unchanged. Replaying the bank scorer at 48 months moved gross motor from +4 to +10 after catching, while repeating pouring left fine motor at +4. Those are local bank-only calculations, not screenshots or certification of the complete live graph, which can include other catalog evidence.

**Correction to the earlier file:** the initial route diagnosis and one-question replay were real, but they did not establish equivalence between these paths. Chat's completion means its selection window ended, not that Homa found the child's actual level. The older algorithm already supplies broader probing, but its lack of stale-answer refresh, cap-based stop and automatic plan rebuild mean restoring it unchanged is not an approved solution either. No algorithm here establishes a precise developmental age merely by completing a sitting.

**Required outcome and acceptance:**

- Preserve the selected child and subject and actually ask the first relevant question, including for returning families and older report links.
- Use existing evidence to explore relevant easier or harder abilities and revisit stale evidence when appropriate. Do not silently stop because the ordinary age-plan window ended.
- Distinguish a completed bounded sitting, insufficient evidence, and no remaining bank coverage. Explain what the answers establish and what is still unknown.
- Save only validated evidence for the correct child; verify the resulting evidence and Progress display after the answers. Do not promise every answer changes the number.
- Check the actual fine/gross-motor examples, music, a child needing easier questions, an already-answered ladder and an exhausted bank. A successful redirect alone cannot close F10.
- Explicitly decide the finishing experience. The transcript asks to update progress; it does not request an automatic four-week-plan rebuild. Keep F11's numeric presentation separate from question selection.

**Additional stop to preserve:** `check-in-service.ts` resumes any nonterminal check-in for the same child before validating the newly requested subject. A request for math while a reading check-in is paused must not silently claim math has started. Same-subject resume, different-subject choice, owner handoff and conflicts need explicit acceptance.

**Implement now:** #1088 owns the handoff plus a subject-deep-dive selector within the existing authenticated check-in service. Reuse the broader bank algorithm while adding stale-edge refresh, fresh-answer exclusion, an eight-response sitting bound and explicit completion reasons. Keep ordinary onboarding selection stable. A fleet procedure owns how Homa explores uncertainty and explains the result; deterministic code owns eligible questions, exact writes and stopping limits. Return to updated Progress; an automatic four-week-plan rebuild is not part of this request.

**Required tests/evals:** the actual motor states above, music, easier questions, stale edge, all-easy evidence, skip/not-sure, exhausted bank, sitting cap, active different-subject check-in, owner/conflict rules, duplicate/foreign writes and unchanged-score case. A behavioral eval must judge the actual questions and honest finish, not only that a tool was invoked. A transactional integration test and live sandbox journey must verify saved evidence and the resulting Progress display. Both failures remain escalated and unfixed at this snapshot.

### F11. Restore meaningful numeric context on mobile web

**Tracking:** [#1097](https://github.com/sidneyswift/homa/issues/1097).

**Verified implementation, not yet shipped:** [Comparison procedure, exact evidence and failed evals](2026-09-06-progress-month-context.md). The current scorer already produces the numeric comparison; the candidate restores it on web with dated credited evidence and honest limits. Deep tracing additionally found stale always-on instructions and a full-report payload mixing saved scores with current answers. Those paths are included in the repair. Passing local checks do not establish live acceptance.

**Expected, R20-21:** the months-ahead comparison that helped the parent understand her child's subject progress. Sidney explicitly confirmed this meaning and authorized implementation on web.

**Active computation:** [scoring.ts](../../../packages/core/src/map/scoring.ts) gives an easily answer the early edge of its cited typical-age window or single anchor, discounts getting-there by six months, and takes the strongest credited anchor minus chronological age. `frontierDeltaMonths` is the raw signed result. `monthsAhead` caps positive display at the smaller of 24 months and roughly one-third of the child's age. `beyondScale` marks a floor/cap or the end of the bank. `highConfidence` means at least two observations, not a statistical confidence interval. Unknown and exposure-only subjects have no numeric comparison.

**Active visible result:** [subjectLine](../../../packages/core/src/map/sentences.ts) returns an empty `numberLabel` in **every** branch. The tile's conditional append therefore cannot expose numbers today. The web trajectory retains numeric data internally but substitutes qualitative axis/legend labels. Commit `c59da87d` removed web/shared comparisons; #625 separately covered native. The prior review's suggestion that another active tile still supplied numeric context was incorrect.

**Chat is another path:** [family-context.ts](../../../apps/web/lib/family-context.ts) still renders capped “ahead about N months,” a numeric “chart reads” string and working edge from compatibility answers, bounded to 4,000 characters. It omits evidence dates/derivation and incorrectly says the parent is looking at that number. Canonical Progress can also score taxonomy evidence, while the additional live-progress chat context omits scores. Shared formatting alone does not prove full UI/chat parity.

**Replayed:** at 48 months, catch-easily gives internal +10 but visible A clear strength and blank numeric label. Skip-easily gives raw +20, capped 16, beyond-scale true and internal `16+`, still blank in the subject sentence. Gallop-not-yet alone gives no number. The [benchmark corpus](../../homa-benchmarks/README.md) is dated cited research spanning milestones and standards; it is not a standardized national test. Existing arithmetic is not evidence of national-test calibration.

**Implement now:** a web-specific comparison beside the subject reading/selected chart detail, using existing capped values, “at least” for a floor, saved evidence/date and a clear method/source explanation. Respect nulls and sparse/stale evidence. Preserve neutral signed-chart behavior under the existing ruling, with no behind verdict, whole-child score or sibling comparison. Fix canonical chat parity and stale chart wording. Placement and these display semantics are routine authorized choices; no new approval is required. Scorer recalibration and native extension are separate scope.

**Acceptance:** positive, capped, zero, raw negative, only-not-yet, unknown, exposure-only, sparse/stale, plus canonical taxonomy evidence. Web/chat agree about the same subject and basis; native comparison-pill regressions remain absent. Parent comprehension still needs a usability check, not merely a snapshot pass.

### F12. Explain what the abilities map actually means

**Tracking:** [#1098](https://github.com/sidneyswift/homa/issues/1098).

**Expected, R22-36:** understand dots, age band, connections and where the evidence came from; investigate one ability without a founder explaining the screen.

**Active read/render chain:** [abilities-explorer.ts](../../../apps/web/lib/child-progress/abilities-explorer.ts) combines assessment taxonomy and bank nodes for math, literacy and science. X is the midpoint of a teaching-age window over ages 4-14; Y is visual spacing only. The shaded year is the child's chronological age clamped to the chart, not an assessed position. Validated projection answers become Knows for easy and Working on now for getting-there. **Unknown, explicit not-yet and conflict all become Up next**, with more detail preserved separately. Only hard within-subject prerequisite edges are drawn. They do not unlock instruction, infer prerequisite mastery or prove every gray node is the child's next lesson.

The [component](../../../apps/web/components/progress/abilities-explorer.tsx) already explains dot/X/Y/band basics, but its leading evidence sentence says parent answer even when the source is inferred; the payload drops the derivation field. The transcript's explanation that logging an angles worksheet makes that ability known is therefore not the implemented rule. Hours and completion alone do not mark mastery.

**Entry/result/stop:** tapping a dot only opens detail. Ask Homa sets a family-validated five-minute ability-focus cookie, sets the child preference and opens `/app`; it neither asks nor prefills a question. The next user turn receives the validated hint. A failed cookie-set result is not exposed by the caller. This is a contextual door, not an automatic assessment or save.

**Implement now:** distinguish unobserved, explicit not-yet and conflict in explanatory status/detail; preserve and name direct/inferred provenance; explain that connections describe curriculum dependencies, not a personal unlocked sequence. Make the ability handoff visibly carry a scoped question or report failure. Reuse F09's handoff infrastructure while keeping explanation separate from assessment writes.

**Acceptance:** unknown/direct/inferred/stale/not-yet/conflict, out-of-axis age, selected-child/ability handoff and expiry/failure. Opening a node writes no progress; timed worksheet completion never lights one. Existing graph/helper tests passed, but whether the revised explanation works for these parents remains a usability outcome.

### F13. Capture actual capability and clarify selectively

**Tracking:** [#1099](https://github.com/sidneyswift/homa/issues/1099).

**Release update:** contextual capture and its exact provenance/age checks are implemented. [Shipping evidence and remaining limits](2026-09-06-contextual-progress-shipping.md) distinguish historical replay, real database saves and the still-unrun replacement transport-independent model cases. The original audit below describes the before state.

**Expected, R37-59 and R72-116:** brief logs should remain easy. When mastery is genuinely ambiguous, ask one useful question and honor not yet. A lesson number, elapsed time or “we moved on” alone cannot establish mastery.

**Active chain:** [Planner skill](../../../apps/web/agent/skills/planner/SKILL.md) logs actual work and explicitly separates completion from mastery. [Always-on instructions](../../../apps/web/agent/instructions.md) route separately reported observable capabilities to `manage_child_progress`. That tool takes authenticated canonical inbound text, then [journal-capture.ts](../../../apps/web/lib/child-progress/journal-capture.ts) loads the family roster, asks the model for claims, and validates them. The extractor excludes plans, requests and time-only reports. [Claim validation](../../../apps/web/lib/child-progress/claim-validation.ts) checks real catalog/child IDs, actual quote, age plausibility and confidence. The [progress service](../../../apps/web/lib/child-progress/progress-service.ts) transaction writes accepted evidence and refreshes derived progress; no accepted claim instead writes an unscored `child_observations` row and returns `no_match`. A friendly “noted” receipt is not a score update.

**Live verification:** September 5 skipping, excellent cutting and curves/zigzags messages each returned `no_match` and exist as observations. The cutting score still uses July 7 getting-there. Other last-week calls produced progress updates, so this does not prove a universally disabled extractor. The three failed messages depend on pronouns or the previous question. The extractor receives current text and full roster but omits the already-known focused child and preceding question. **Unproven cause:** this context loss may explain the missed match; the old receipts contain no rejected proposal/cause. A model replay is required before calling it the diagnosis.

**Implement now:** replay those exact contextual cases, then supply narrowly authenticated focus/question context where needed while keeping quotes tied to the current parent message and IDs family-validated. Put clarification timing and “moving on” judgment in a fleet procedure. Preserve unscored observations and ask at most one material clarification when it would change a supported claim. Do not interrogate every log or use keyword rules to decide meaning.

**Acceptance/eval:** actual follow-ups, named child, unambiguous pronoun, competing sibling/ambiguous pronoun, time-only, lesson-number-only, moving-on ambiguity, explicit independent ability, help needed, decline and multi-child recap. Inspect extraction, accepted claims, durable writes and final receipt. No unsourced mastery; no repeated probing after decline. This is dedicated capture work, not merely copy polish.

### F14. Offer one useful next step from current evidence

**Tracking:** [#1100](https://github.com/sidneyswift/homa/issues/1100).

**Release update:** scoped evidence reads and chat verification are implemented, and all five evidence-based model cases pass. [Shipping evidence](2026-09-06-contextual-progress-shipping.md) records remaining boundary failures, including incomplete evidence being described as complete. Sidney directed shipment without additional test rounds; #1100 remains open for those behavior gaps. The original audit below describes the before state.

**Expected, R92-120:** after saving progress, offer optional help that fits what the child can currently do. Avoid suggesting cutting drills the parent already says are easy.

**Active supported capability:** [progress-next-move](../../../apps/web/agent/skills/progress-next-move/SKILL.md) reads current evidence and calls `verify_progress_next_move` before advice. [Its verifier](../../../apps/web/lib/child-progress/next-move.ts) reloads the canonical family-scoped ledger, excludes evidence older than 30 days or with unknown provenance, and allows only current non-easy evidenced abilities as targets. Conflicts or inadequate evidence lead to one clarification. All fresh evidence easy means no manufactured target. Ordinary conversation receives a read-only activity/reason; scheduling or materials require the parent's separate request. An unassessed next-ability extension is **not** currently supported by this verifier.

**Live mismatch:** at September 5 01:26 UTC Homa proposed multiple motor/cutting activities. That turn made no tool calls; the session had loaded Planner and materials-studio, but not progress-next-move or its verifier. Its straight-line cutting target was July 7, getting-there, unknown provenance. The verifier would refuse that evidence; the observed response bypassed it. Carolyng then said the drills were already easy.

**Missing read context:** detailed agent progress context takes the first six subjects in projection order, commonly math through science. Music and motor are positions 9-11. The older all-subject snapshot may still name a working edge without date/derivation. Therefore simply saying “use fresh context” in the skill does not supply omitted evidence. A scoped read or focused injection is needed.

**Implement now:** make explicit next-step requests and supported post-update offers route to the existing skill; supply fresh selected-child/subject evidence and preserve verification. Offer one optional action, or one useful clarification if the evidence cannot support it. Keep broader next-skill extensions as a separately designed capability rather than bypassing the verifier.

**Acceptance/eval:** exact stale cutting case clarifies instead of repeating drills; corrected evidence changes the target; all-easy case stops honestly; source IDs remain valid; multi-child updates remain bounded; no material/schedule without request. Run positive/adversarial routing and behavior evals, including an assessment request that must not become practice. Passing the existing verifier tests does not establish skill adoption.

### F15. Periodic progress review

**Tracking:** [#1107](https://github.com/sidneyswift/homa/issues/1107).

**Expected discussion, R60-116 and R120:** some reminder or review should keep evidence current, but immediate, weekly, fortnightly, monthly and quarterly approaches were all proposed. One parent explicitly rejects repeated probing across three children.

**Current rails:** [task kinds](../../../apps/web/lib/tasks/kinds.ts) include an opt-in daily evening journal, morning brief and parent-created custom tasks. The hourly dispatcher uses durable schedules/runs and idempotency. `create_task` requires confirmed weekdays, hour and delivery; its exposed cadence is weekday/hour, not monthly. An evening journal is not a periodic assessment. #401 was closed as Cut without settling cadence, with reopening conditioned on direct demand or valuable-but-undiscovered use. These meetings supply demand, not one agreed schedule.

**Action now:** record a decision/opt-in experiment with cadence, per-child scope, burden, stop behavior and observation-versus-assessment purpose. Reuse existing scheduling rails once selected. An opt-in experiment can be prepared without enrolling anyone. Do not silently enable outbound contact, recurring graded tests or automatic mastery credit. Completion requires an explicit product choice and then delivery/stop-state validation, not a new generic reminder merely because the scheduler exists.

### F16. Make an accepted curriculum actually readable

**Tracking:** [#1089](https://github.com/sidneyswift/homa/issues/1089).

**September 6 deployment and recovery:** [PR #1114](https://github.com/sidneyswift/homa/pull/1114) merged at `40359589c8d6ea6a4be40118bfa8765c8b610926`; its production deployment `dpl_FowhbTVDzit3FgtB5j6JRecbz1B6` reached READY and served `thankshoma.com`. The [repair contract and validation](2026-09-06-large-scanned-pdf-repair.md) cover a bounded 64 MiB reader, selected-page transcription, canonical source/page cache, attempt ownership and resource limits. The additive schema is applied. This replaces the byte-cap and blank-scan behavior described in the audit baseline below.

The first original now has Ready metadata and a readable instructional spread at physical PDF page 11, printed pages 20-21. Visual comparison verified the lesson heading, five-toy material count, one-to-one pointing/counting instructions and final quantity question. A separate read-only database comparison confirmed all seven canonical page fields match the fresh result exactly; the operator's initial replay failure was an object-property-order comparison bug. The corrected ordinary page-read probe subsequently passed with an identical canonical replay and zero new transcription calls. The original full checksum, size and URLs remain unchanged. This is reviewed local code operating on production data, not proof of hosted execution or complete book coverage.

**FIXED and recovered, September 6 at 18:26 UTC:** [PR #1116](https://github.com/sidneyswift/homa/pull/1116) merged at `78466fe63311f8a14934ada7fc569d95a3742a24` and its production deployment is READY on `thankshoma.com`. Explicit minimal-thinking transcription now reads the previously failing physical page 3 in 5.289 seconds. Root compared its content with the actual scan and verified an identical cache replay with no extra OCR. The separately guarded metadata retry brought the second original to Ready with no error, preserved full original checksum/bytes/URLs, and explicit limited coverage from pages 1-6 of 115. Its physical page 17, printed pages 6-7, now yields the readable Red and Blue lesson: root verified the objective, materials, color/shade examples, object matching and circle/blue-crayon instructions against the scan. That read made one OCR call and replayed identically without another. These original recoveries use the reviewed local source against production records; the separate actual hosted upload/reader/deletion journey passed with a small synthetic scan and verified cleanup. Neither test claims complete-book extraction. [Live evidence and exact limits](../journeys/evidence/2026-09-06-library-pdf-live-verification.md).

**Expected, R37-47 and R120-143:** upload a scanned teacher book once, then use it without photographing each lesson again. Preserve the original.

**Audit baseline before PR #1114:** upload accepts up to 500 MiB through 8 MiB chunks, verifies the family-owned Blob and creates the asset, then schedules metadata processing. [family-asset-processing.ts](../../../apps/web/lib/library/family-asset-processing.ts) independently caps complete downloads at 32 MiB, checking headers and streamed bytes. Exceeding it retains the original and marks Needs attention. PDF classification extracts text from at most 120 pages/64,000 characters with no page OCR; image files use a separate caption path that scanned PDFs never enter. Classification saves metadata, evidence quotes and one embedding, not a complete page-text corpus.

[read_family_curriculum](../../../apps/web/agent/tools/read_family_curriculum.ts) requires Plus and a family-owned, top-level, Ready curriculum. [family-curriculum-source.ts](../../../apps/web/lib/library/family-curriculum-source.ts) downloads the whole file again for each cursor, reads up to 240 pages without OCR and returns at most eight segments/32,000 characters. It can report success with blank page text. Ready metadata is not proof of complete lesson coverage.

**Verified:** Carolyng's actual 41.3/47.2 MiB September 5 originals hit the cap; a real reader returned not-ready. At 01:42 UTC her Dimensions first-week request ended with Homa asking for another photo. A local PDF with a drawn shape and no text layer produced classifier unreadable but reader success with one empty page. That proves a reader-contract defect. A subsequent read-only inspection of the actual private originals established the missing fact: Preschool Math at Home is 43,261,422 bytes with 51 pages, all without text items; Dimensions Math Teachers Guide PKA is 49,496,583 bytes with 115 pages, all without text items. Thus neither can be repaired by raising the byte cap alone, and neither hits the existing page-count ceilings. These were file reads and PDF text scans, with no model calls or production writes. The original SHA-256 values are `4bca3cad757d3cd9a51915c42dce49943a84562742352388a6113086e9316201` and `b66babd5d88d39a4bfc2569eca3c811d63b5f7b002864c97c5dc69a27d7e33cb`, respectively.

**Repair scope delivered above:** bounded processing/read support for the observed sizes, page OCR/transcription when a PDF has no usable text, preserved locators/extraction provenance, and honest partial/unreadable states. Avoid a 500 MiB unbounded in-memory download or manually setting Ready. After prevention passes, retry only identified failed originals within an explicit recovery scope and prove numbered-lesson retrieval.

**Verification contract, with actual coverage and limits above:** observed-size text/scanned/mixed PDFs, late pages beyond 120/240, blank versus unreadable, encrypted/corrupt/foreign files, interruption/retry, bounded memory/deadline and truthful coverage. Upload success alone cannot close #1089.

### F17. Use the correct owned lesson

**Tracking:** [#1101](https://github.com/sidneyswift/homa/issues/1101).

**Expected, R37-63, R122-143 and R306-318:** “lesson 12” identifies the child's actual curriculum/edition; Homa reads it and produces matching practice or another teaching activity. The parent also asks for the next five lessons and a useful lesson packet with teacher guidance, discussion, hands-on activities and supporting printables. That bounded packet is an operational request, separate from choosing a native first value or scheduling a full year. Completion is not mastery.

**Active retrieval:** [family-librarian](../../../apps/web/agent/skills/family-librarian/SKILL.md) finds and opens an asset before handing off. [family-asset-retrieval.ts](../../../apps/web/lib/library/family-asset-retrieval.ts) searches title/file/authors/publisher/tags and one embedding, whose input is clipped to 8,000 characters. Search excludes derived unit assets. Opening an original returns metadata and up to 20 evidence quotes, not lesson pages or its units. A known unit ID from a previous approval/Planner source can still be opened; not all unit access is absent.

The page reader is currently routed as Plus full decomposition through [curriculum-mapping](../../../apps/web/agent/skills/curriculum-mapping/SKILL.md), with asset/cursor rather than a lesson query. Ordinary Library-to-materials handoff does not specify a targeted-lesson reading procedure. [Mapping](../../../apps/web/lib/library/family-curriculum-mapping.ts) proposes at most 120 units/40 placements into existing weeks 1-4; verifies Ready source, page quotes, child assignment, subjects, plan and capacity; then signed session/family-scoped approval rechecks versions and transactionally creates unit assets and appended activities. It does not give them calendar dates or create a year schedule. Quote presence establishes provenance, not summary accuracy or full-book reading.

Material source provenance validates identity and inheritance, but a direct-original badge only carries ID/title; it does not prove the output matches lesson 12 or retain that page's quote. The failed Dimensions journey is live evidence; no successful saved decomposition or lesson-generation journey was found for Carolyng.

**Implement now:** teach existing skills the targeted resolve/read/use procedure; extend exact source-page/unit retrieval only where the current tools lack it. Resolve real child/curriculum/edition ambiguity once. Carry lesson/page evidence through generation. Preserve current access/tiering rules and avoid requiring a whole-book decomposition for one lesson.

**Acceptance/eval:** readable fixture with correct and wrong-edition lesson 12 and multiple children; correct source/page, content-matched exercise and saved citation; late lesson, scanned page, missing lesson, unclear child and known saved unit. No Planner/date/mastery write merely from asking for practice. Judge actual output against source pages. Include a requested next-five-lessons packet: identify and read each lesson, preserve order and child/edition, include usable teacher guidance, discussion or hands-on work where supported, and assemble the requested supporting printables. Report any unreadable or missing lesson explicitly; do not claim a complete packet from one generic worksheet. This does not require automatic calendar placement. Existing find/get-order tests do not establish this outcome.

### F18. Connect relevant owned resources to a teaching theme

**Tracking:** [#1102](https://github.com/sidneyswift/homa/issues/1102).

**Expected, R170-181:** an apple/letter-A request can surface an owned book, useful curriculum activity and tailored page without the parent supplying a file path.

**Active mismatch:** [materials-studio](../../../apps/web/agent/skills/materials-studio/SKILL.md) explicitly limits Library retrieval to an explicitly named owned/uploaded source, excluding ordinary fresh-material requests. Family-librarian routing has the same boundary. This was a procedural choice in PR #609/#577, not a located founder prohibition, so current implementation authorization can improve it. Existing semantic search is a primitive, not the requested complete behavior.

Search only sees indexed metadata/embedding content; a useful apple activity late in a Ready book may be invisible. A strict child filter also excludes shared unassigned family resources. A matching title is a candidate, not proof of useful content. No successful apple-theme owned-source output was established in the audit.

**Implement now after F16/F17:** bounded opportunistic lookup when a themed teaching request and family context make owned resources useful; open and cite actual relevant content before use. Include shared sources. A miss still produces a useful requested page without inventing ownership. Meaning-based choices belong in the skill, not a keyword trigger list. Preserve the negative case where an ordinary quick worksheet gains nothing from a Library detour.

**Acceptance/eval:** exact apple example, unnamed relevant book, shared source, irrelevant similarly titled book, late-book activity and no matches. Assert actual output uses the cited pages and only a small directly relevant source set. This is not a continuous unsolicited recommendation system.

### F19. Handwriting must fit its guides

**Tracking:** [#1094](https://github.com/sidneyswift/homa/issues/1094).

**Expected, R145-173 and R312-318:** correct letter geometry and usable practice without repeated parent debugging. Reference choice and rendering are separate quality checks.

**Actual family evidence:** four September 1 revisions used `input.path: html`, no recorded recipe. The 16:35 mixed-case page passed generic review; the parent then replied “Still wrong.” The [rejected preview](https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/families/304f0003-6c55-4c31-807a-941aff214283/materials/amalia-s-name-tracing-practice-A4D83SDt8CVucpAxN4O3mzEor87G9o.jpg) and saved HTML show the undersized capital/ascender problem. A [later revision](https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/families/304f0003-6c55-4c31-807a-941aff214283/materials/amalia-s-name-tracing-practice-bNHRnqVA5X0QQMN4lr4YvCq8cMF9tk.jpg) changes AMALIA to all capitals. That is not a mixed-case fix. The literal D page is still unidentified; #1080's image-direct probes cannot substitute for this actual HTML failure.

**Measured cause:** saved HTML uses Fredoka 400 at size 110, SVG baseline 129, guides top 2/mid 66/baseline 130. The currently referenced font outlines put A's top at 53.32, lowercase a at 76.86 and tall l at 52.11, consistent with the observed undersizing. Historical font-network success is not archived, so these measurements prove current referenced-font geometry, not that historical request. The current [name-tracing recipe](../../../apps/web/agent/skills/materials-studio/references/recipes/name-tracing-page.md) prescribes size 174; that puts A at 9.29 but lowercase a at 46.52, above the intended midline. One uniform font size cannot fit both cap height 128 and x-height 64 for this font's proportions. SVG coordinate coupling alone is insufficient.

**Active pipeline:** skill selects reference/recipe/path; `create_printable` authenticates and verifies source IDs, builds HTML, waits for fonts in Chromium, renders PDF/preview, measures page bounds, reviews, uploads and stores metadata. Existing geometry gates detect cutoffs/page fill/largest elements, not individual glyph baseline or x-height alignment. The reviewer sees pixels and optional checklist/anchor. Disabled/unavailable review returns null under existing policy; there is no exact handwriting geometry gate. The rejected family artifact predates the September 2 structured checklist, so it is not evidence that the new checklist passed this page.

**Implement now:** a verified font/guide rendering procedure or narrow exact glyph primitive, preserving requested case and correct forms. Keep pedagogy/format judgment in the recipe, record recipe identity on drafts/revisions, and measure exact guide alignment. Do not merely upload more examples or weaken review policy.

**Acceptance/evals:** mixed-case Amalia, descenders, uppercase D/S, lowercase a/m, trace/pale-fill/independent rows, preserved packet pages and case. Inspect final PDF at print size and measure glyph positions. Run reviewer against known-good and known-bad specimens to measure false positives; page-fill/size-floor evals alone cannot close #1094.

### F20. Respect urgency and preparation depth

**Tracking:** [#1102](https://github.com/sidneyswift/homa/issues/1102), [#1108](https://github.com/sidneyswift/homa/issues/1108).

**Expected, R175-181 and R318-323:** something useful when rushed, richer source-grounded help when preparing ahead. The spoken two/eight-minute figures are hypothetical, not measured targets.

**Active chain:** materials-studio chooses HTML/image/hybrid for accuracy and revision needs, gives a progress note and avoids precise time promises. `create_printable` has no quick/deep input or measured two/eight-minute contract. Provider/render duration is not the parent's whole wait through revisions and abandonment.

**Implement now:** honor explicit urgency in the existing skill while keeping minimum correctness; honor explicit source-grounding through F17/F18. Add contrasting “needed now” and “for next week, use my curriculum” evals and measure time to a usable artifact. Saving an urgency preference or generating a second packet without a request is not implied.

**Future decision:** a universal speed picker, new latency promise or global remembered mode needs evidence and a UX choice. No defect is claimed merely because a picker does not exist. Acceptance for the bounded change is useful correct output under each stated intent, with honest waiting/retry behavior.

### F21. See Delete and keep unwanted work removed

**Tracking:** [#1091](https://github.com/sidneyswift/homa/issues/1091).

**September 6 production receipt:** removal FIXED by commit `1834875f69b70b623194f196054be8a73a2e1f22`, PR #1110. Deployment `dpl_5T63hpNJKB38cKRUmpsf1Z2g5GU8` was READY and both removal/visibility migrations applied. A real mobile-web delete plus refresh removed all five sandbox revisions with the same timestamp, retained artifact references, and left an unrelated kept worksheet. A further real Bring back check exposed missing Chromium archives in the Binder function. Restore is now FIXED by PR #1111, commit `dce9f1c55b198f82da0f978983f78c81efe5790a`, READY deployment `dpl_E4TiWzbMdL88PTAQ5SYuhahSxqiG`. The actual mobile-web action rendered a new PDF/preview, retained three versions, and survived refresh. Removing that kept chain hid all three rows while an independent same-title draft remained. Synthetic Binder controls were then removed. The one verified historical poster chain was repaired through the shipped RPC under its family membership: five resurfacing ancestors removed, six history rows and artifact references retained. [Full production receipt](https://github.com/sidneyswift/homa/issues/1091#issuecomment-5560432068).

**Expected, B:** remove abandoned in-progress work because it is unwanted or a better version exists. The meeting proved that sideways scrolling revealed Delete and a tap appeared to work; it did not establish persistence after refresh.

**Audit baseline, read/layout:** [Binder](../../../apps/web/app/app/binder/page.tsx) reads in-progress materials scoped to the family and selected child plus shared records. A read error becomes an empty shelf, so disappearance alone is not a reliable success proof. [Material selection](../../../apps/web/lib/materials/library.ts) reads at most 300 nondeleted rows, then chooses one visible candidate per revision chain. The [shelf](../../../apps/web/app/app/binder/in-progress-shelf.tsx) renders two columns on phones with nonwrapping normal actions; confirmation uses a separate wrapping row. The first Delete tap opens confirmation, Keep cancels, and final Delete calls the authenticated action. Success hides only that material ID locally.

**Audit baseline, write/reread:** [delete-material-action.ts](../../../apps/web/app/app/binder/delete-material-action.ts) resolves family and caller JWT, then `softDeleteMaterialCaller` updates `deleted_at` for one family-owned, nondeleted material ID and revalidates Binder/chat. It does not remove Blob bytes or other revisions. Reread filters that row before chain selection, allowing an older eligible draft to become the visible card.

**Verified before repair:** actual component/production CSS at widths 320/375/390 produced document widths 424/452/459; at 390 the second Delete ended at x459.46 and the first Delete overlapped the next card's Keep. Separately, a six-record *Ara's Ghost-Spider Space Poster* chain contains a revision deleted September 5 16:39:07.904 UTC with eligible undeleted ancestors. Replaying the actual selector on saved rows chooses the deleted revision before filtering, then its preceding draft after the real deletion filter. This proves persistent-state resurfacing; it is not claimed to be the exact recorded meeting tap. No family material was deleted during the audit.

**Repair scope delivered above:** #1091's layout repair plus durable removal of the visible connected item across revisions, retaining history/bytes under existing collection-removal semantics. Do not hide by title or erase unrelated same-title work. The separate Month plans shelf has Review with Homa and a different archive primitive; its missing Delete was not established by B.

**Verification contract, with actual coverage and limits above:** normal/confirmation actions at 320/375/390, long titles, keyboard/touch, pending/error/cancel, refresh; observed-style revision chain, kept final, sibling branches, independent same-title chain, already-deleted/missing/foreign IDs and shared/child materials. Verify actual reread, not only optimistic disappearance.

### F22. Make the actual child scope visible

**Tracking:** [#1106](https://github.com/sidneyswift/homa/issues/1106).

**September 6 additional production verification:** the populated sandbox proved normal child selection: Avery's 11 minutes plus 5 shared minutes remained, while Jordan's separate 15 minutes disappeared. A contradictory child link exposed another live defect: Avery's stored selection plus a Jordan query showed Avery's 16-minute record list but Jordan's 5-minute total. [Exact reproduction](https://github.com/sidneyswift/homa/issues/1106#issuecomment-5560478415). The repair uses one owned-child resolver for the page and selector, preserves that focus across Planner navigation, and clears a link override when the parent makes a new selection. [PR #1115](https://github.com/sidneyswift/homa/pull/1115) merged at `69abbefdd2cc507c55f07c577c1235ce27168626` after both required checks passed on exact head `7bf1c4af92acf14febfe7865c4f75b20ac50ba50`. Production deployment reached READY. The real signed-in browser journey passed at 17:22 UTC: child/query/cookie precedence, explicit selection, reload, shared-time rows/totals and empty Binder scope matched. All synthetic account data was removed; canonical deletion safety markers remain.

The populated Binder also showed a false failed-search message when its one kept item was already on the default cover and no search was active. This is separately tracked in [#1113](https://github.com/sidneyswift/homa/issues/1113), bundled into the same UI repair. Actual search/filter no-results and a truly empty Binder must remain distinct.

**Implementation verification:** the shared resolver, visible labels, failed-selection recovery and Binder empty-state repair passed 62 focused tests, 180 onboarding checks, TypeScript, scoped lint, the isolation preflight, full Next build and independent source/copy review. [Detailed verification and explicit browser/production limits](../journeys/evidence/2026-09-06-child-scope-verification.md). The subsequent deployed journey passed 169 assertions with four actual preference actions, eight scoped UI states, exact durable readback and verified fixture cleanup. The populated cover was subsequently recreated in a separate production run: 144 assertions passed with one actual kept worksheet/loaded preview, correct no-match search, clear and reload, and verified removal of both blobs and all owned account data. Root inspected the two final screenshots. [Populated Binder receipt](../journeys/evidence/2026-09-06-binder-cover-live-verification.md).

**Expected, P22 and B:** review one child's Hours/Binder without confusion. Both parents discovered an existing switcher during the meeting, so a second filter is not the requested solution.

**Audit baseline, switcher:** [context-switcher.tsx](../../../apps/web/components/dashboard/context-switcher.tsx) appears for at least two children after device detection. Its closed trigger is an avatar with an accessible Viewing child label; visible names are inside the open menu. Selection optimistically changes the UI, validates the child against the caller-owned roster, stores an httpOnly preference cookie and refreshes/navigates. Invalid/foreign/stale IDs become no-op or family view; this preference is not authorization or durable child data. The action has no explicit retry/error receipt.

At audit time, Hours included selected-child plus shared rows before subject filtering and totals. Its useful scope explanation was hidden in embedded mode, and Planner always embeds it. Binder scopes kept and in-progress materials; its kept heading names the child plus family-wide items. **Month plans and state-pack cards remain family-wide**. Do not describe the whole Binder as uniformly filtered. The export gap is F06; chat/shared-time inconsistency is F07.

**Initial audit verification:** selecting Avery at 390 px changes the header label and kept-Binder wording. Actual helper tests with populated child-A/child-B/shared inputs confirm Hours/material scoping and shared contributions. The later authorized sandbox records provide populated UI data; they do not by themselves prove every child-switch/export case passed.

**Repair scope delivered above:** visible concise scope guidance near the records, reuse the switcher, explicitly name shared inclusion and family-wide shelves, and surface failed selection honestly. **Verification contract, with actual coverage and limits above:** one/two-child families, empty/populated, shared items, reload, child changes and keyboard/touch. An Instagram/onboarding explanation is optional distribution work, not necessary to implement another filter.

### F23. Distinguish dictation from conversation and repair voice tools

**Tracking:** [#1103](https://github.com/sidneyswift/homa/issues/1103).

**September 6 production receipt:** FIXED by PR #1112, merge `df9d5860ae3c5ede42fad3624588223a089b47f3`, READY deployment `dpl_7C9DPVKykuKXgHjVHmpYPCaQVNtG` on thankshoma.com. The corrected controller/routes passed 104 deterministic checks, actual-component browser lifecycle checks, and two isolated model evals with 9/9 gates. A real production bridge probe passed 88 assertions: one 17-minute Hours write, read-only follow-up using the returned continuation, one exact action receipt and four owned canonical turns, then verified fixture cleanup. [Exact path, observed scenarios and limits](../journeys/evidence/2026-09-06-web-voice-verification.md). Physical phone speech remains unverified; Sidney has been asked for that check.

**Expected, R202-219:** intentionally choose dictated editable text or back-and-forth speech. The meeting's greeting did not prove that spoken logging/planning worked.

**Dictation chain:** [dictation.tsx](../../../apps/web/app/app/dictation.tsx) checks microphone/MediaRecorder support, requests permission after tap and records with an interruption marker. Cancel discards; accept or the three-minute cutoff stops and sends audio to the authenticated `/api/chat/dictation` route, bounded to 4 MiB and 30/hour. The existing STT path retries transient primary failures then uses a fallback. Success appends text to the editable draft; **only the parent's later Send** enters ordinary chat and family writes. Denial/empty/failure gives a typing/retry path. The recording is not automatically a spoken reply. Transcription disables accept/cancel; no browser/provider timeout is implemented, and recorder-constructor/start exceptions are not fully caught. Those are code limits, not matched new family incidents.

**Audit baseline, realtime chain:** the empty composer exposes [Talk with Homa](../../../apps/web/app/app/voice-mode-button.tsx); a draft/attachment changes that slot to Send. [VoiceMode](../../../apps/web/app/app/voice-mode.tsx) obtains an authenticated, access/rate-limited realtime token, connects, then captures microphone audio. Status and End are visible; End disconnects/releases capture and flushes the transcript. Realtime's `ask_homa` function is required for family tools/facts and artifact work.

**Audit baseline, confirmed source-contract failure:** the web client posts only tool name and args to `/api/voice/realtime/tool`, but the [shared route](../../../apps/web/app/api/voice/realtime/tool/route.ts) requires session ID and nonnegative source sequence. It returns HTTP 200 with `ok:false`, a repeat request and empty effects before persistence or agent dispatch. Replay of the actual client body through the actual route gave zero persistence and agent calls; a complete positive control reached each once. This affects every current web tool call, not merely unclear buttons.

**Audit baseline, durable-result gap:** settled transcript turns are separately posted fire-and-forget; a visible transcript does not establish saved canonical messages. The client ignores unsuccessful save receipts/retry and does not consume returned effects or Homa session state as native does. A greeting can therefore coexist with broken action capability.

**Repair scope delivered above:** separate bridge bug and discoverability issues. Carry stable voice session/source sequence and real transcript provenance, preserve returned continuity state, handle transcript ordering, prevent duplicate writes/dispatch, and show truthful effects. Reuse server contracts rather than relax them. Make the two controls visibly distinct, preserving edit-before-send and text fallback.

**Verification contract, with actual coverage and limits above:** actual browser payload, missing/out-of-order transcript, two actions in one conversation, harmless read plus authorized sandbox write, exact effects, denial/expiry/provider-refusal, no duplicate or extra replies, End releases mic. Run continuity/voice/chat suites and isolated bridge evals, then a real mobile-web spoken turn. Screenshots and the mocked positive control cannot certify physical voice output.

## Existing foundations and future contracts

### F24. Respect breaks now; design full-year scheduling separately

**Tracking:** [#1104](https://github.com/sidneyswift/homa/issues/1104), [#1108](https://github.com/sidneyswift/homa/issues/1108).

**Expected, P86-98 and R306-318:** remember breaks, derive a likely finish date from remaining lessons, compress/extend deliberately and schedule the chosen curriculum on real dates.

**Active mechanisms:** family-event tools save authenticated date ranges and optional weekly recurrence; [family-events-model.ts](../../../apps/web/lib/family-events-model.ts) expands occurrences and skipped/moved exceptions. It does not make every event a non-teaching day. `schedule_plan_activity` moves one date, without optimizing lesson sequence. Planner reshuffle stays inside a plan week, preserves completed work and stops when the change is too broad/no room remains.

Month preview contains four weeks. Approval validates children/dates/materials/unresolved choices and versions, then replaces the current plan/dates. Curriculum mapping appends at most 40 placements into existing four-week plans and chooses no dates. Repeatedly calling these tools does not establish a safe persistent year plan or finish-date calculation.

**Audit baseline:** [month-plan-draft.ts](../../../apps/web/lib/month-plan-draft.ts) queried original event dates and a compatibility child field. It missed recurrence, occurrence exceptions and authoritative multi-child audiences. The normal Calendar readers also excluded a valid future-series occurrence moved into an earlier window. These were actual-function/source-predicate findings, not claimed Carolyng incidents.

**Current chain, FIXED September 6:** [PR #1118](https://github.com/sidneyswift/homa/pull/1118), merge `ff3258bf999f665a6ca7154ba0c7df73aae481f4`, is deployed READY on `thankshoma.com`. Caller and pinned readers now include family-scoped moved-in candidates. Create/revise reuse those readers and the existing occurrence expander and child audience rules. Source events, intentional-conflict approval policy and signed history are preserved.

**Verified:** real disposable PostgreSQL reproduced the original omission and passed caller/pinned scope, exact create/revise conflicts, foreign-family denial and unchanged event snapshots. The deployed mobile-web journey passed eight complete Week states and two Day details. The same fixture produced exactly 11 initial and 7 revised conflicts from deployment-identical create/revise code through a read-only worker. Root inspected five screenshots; all owned family/Auth/event/exception data was removed. [Live receipt and precise execution boundaries](../journeys/evidence/2026-09-06-recurring-events-live-verification.md).

**Remaining scope:** this certifies hosted Calendar and actual deployed-source conflict computation against production data, not hosted model/tool dispatch, a native preview overlay or full-year planning. Existing Data API pagination and separate-request consistency limits remain in the [implementation contract](2026-09-06-recurring-plan-conflicts.md). A readable owned curriculum, one child, an explicit break and approved month save remain part of the curriculum journey in [#1101](https://github.com/sidneyswift/homa/issues/1101); they are not claimed by this recurrence repair.

**Future contract:** teaching weekdays, irregular breaks, participants, remaining lesson identity/completion, permissible load, finish target and what may move. An absence ledger, automatic holiday feed and state-specific attendance claims are not inferred. The transcript's 180-day example is not verified law. Full-year scheduling remains a design/decision issue, not a claim that month mapping already implements it.

### F25. Choose the native first value and rollout

**Tracking:** [#1053](https://github.com/sidneyswift/homa/issues/1053), [#1045](https://github.com/sidneyswift/homa/issues/1045).

**Expected discussion, R182-201 and R221-299:** candidates include personalized pages, full lesson packets, planning/logging or progress followed by a useful week. Sidney confirmed the narrower offer is native. Another parent valued the broader assistant. A founder-only experiment and progressive onboarding were ideas, not an agreed architecture.

**Current native chain:** root navigates to Chat; navigation exposes Chat, Progress, Planner, Binder and Tasks. The authenticated shell gates session, onboarding, readiness and billing before mounting that broader stack and voice. Web-origin families bypass native onboarding; incomplete native-origin families resume the saved step. Onboarding already offers Make another page, Plan our week and Just look around, records completion and navigates. This is an existing first-page/handoff foundation, not a printable-only app or proof of retention/personalized-week fulfillment. No founder-role experiment is established in this chain. Installed build/device behavior was not verified.

**Evidence versus hypothesis:** parents describe dictating logs, replacing an old planner, wanting their chosen curriculum respected, valuing lesson packets, and using an outside worksheet when rushed. Those are reported behaviors. Claims that one narrower offer converts better, that a free week improves retention, or that a school-buying cycle dictates the roadmap remain hypotheses. The meeting's signup/paid figures lack a cohort/window and are not factual sizing inputs.

**Action now:** reuse #1053/#1045 to define comparable first-session outcomes, actual cohorts and falsifiable return/use/payment measures; verify the existing handoff without changing the selected product. Keep older-child discussion, teacher guidance and hands-on work inside the meaning of lesson packet. A whole personalized week is larger than F14's one next move. Feature removal, pricing/free-week changes, founder-only environment and a new native rebuild require an explicit product choice; they are not routine fixes from this list.

### F26. Make print handoffs truthful by channel

**Tracking:** [#1105](https://github.com/sidneyswift/homa/issues/1105), [#1108](https://github.com/sidneyswift/homa/issues/1108).

**Expected, R230-256:** easy tangible output. Automatic appearance at a printer is a separate speculative concept.

**Active web path:** [Binder overlay](../../../apps/web/app/app/binder/material-detail-overlay.tsx) opens the stored PDF URL in a new tab. Chat material cards use `/api/materials/{id}/pdf`, which authenticates/rescopes, records a PDF-open event and redirects; native bearer calls can receive proxied bytes. These are open/download actions, not physical-print telemetry. The existing authenticated test chat exposed Print all 2 pages, but no printer output was observed.

**Native path:** Binder obtains a prepared authenticated PDF and invokes a system print sheet; native voice consumes `printRequest`. Cancel/success/failure are distinct application outcomes, and even system completion does not prove ink hit paper. Installed native behavior is outside the mobile-web evidence.

**Source-contract defect:** [prepare_material_print](../../../apps/web/agent/tools/prepare_material_print.ts) is available beyond native and only excludes the subject-lesson channel. Its successful reply always says the app is opening Apple's print sheet. Web has no `printRequest` consumer. The general skill instruction can therefore produce a false web handoff claim. No specific Carolyng use of this tool was found; the active producer/consumer mismatch is verified in source.

**Implement now:** channel-aware skill/tool results: native prepares the system sheet; mobile web provides the correct current PDF action with truthful instructions. Preserve selected revision/finalization, requested copy/page roles and source access. Consistently using the authenticated PDF route in Binder can align access/open tracking, without relabeling opening as printing.

**Acceptance:** web gets a usable current PDF and no native-sheet claim; foreign/stale ID and uncertain answer-key/page-role requests refuse; native canceled/failed/completed states stay distinct; final two-page artifact opens at the expected URL. Physical mobile-web printer output still needs device evidence. Unattended delivery, saved printers and automatic physical printing remain a separate integration/product decision.

**Implementation and live evidence:** PR #1125 deployed as `7df600cd`, with required CI, the additive print precondition and exact production READY verified. The real mobile-web conversation and card prepared two copies with the answer-key page excluded. Its download returned 422. The actual Next bundle passed a numeric module ID to a Node worker that requires a filesystem path. This live failure was escalated September 6 at 23:04:46 UTC and is being corrected in the [current-material print handoff](2026-09-06-material-print-handoff.md) release evidence. Passing source tests or dependency tracing did not prove the deployed worker. Physical printing remains unverified.

## Implementation order and completion evidence

1. The bounded issue split is filed. #1092 now owns direct record editing only; export, map, voice, advice and the other outcomes each have the issue linked above.
2. Repair the live handoff/data failures: linked Hours edits and event identity, year/shared scope, deeper assessment, Binder layout/removal and web voice bridge. Use isolated branches and independently testable PRs.
3. Complete categories, scoped exports/recorded days, authorized web numeric context, honest map/scope guidance, contextual capability capture and verified next-step routing.
4. Repair curriculum extraction, prove the targeted owned-lesson and useful-source journeys, correct actual handwriting geometry, and make print handoffs truthful. Fix existing month-preview calendar consistency independently of full-year planning.
5. Keep recurring review, universal speed picker, full-year planning, native focus and unattended printing in explicit experiment/decision issues. Do not use their uncertainty to block unrelated authorized repairs.

For every shipped slice, record: issue and PR; commit; relevant deterministic tests; behavioral evals where model judgment matters; final artifact/UI inspection; deployment READY; and the actual affected live read/write/reread outcome. A merged PR alone does not close a production failure. Run schema/isolation and agent-build guards at their required boundaries. Use the confirmed sandbox family for authorized fixtures; do not silently mutate interviewee history.

## Decisions that remain

| Topic | Bounded work proceeds | Unchosen larger behavior |
|---|---|---|
| Categories | Family-level labels under stable parent subjects | Child-specific catalog ownership beyond this slice |
| Numeric progress | Web capped comparison with evidence and method | Scorer recalibration or native extension |
| Attendance | Correct recorded learning days and shared scope | Untimed days, absences and per-activity exclusions |
| Progress review | Selective in-session clarification and one verified next step | Recurring cadence, participants, consent and assessment format |
| Curriculum/calendar | Correct owned lesson and existing month conflicts | Whole-year horizon, load/finish/reschedule contract |
| Speed/depth | Respect explicit urgency and source request | Universal picker, global remembered mode or latency promise |
| Native focus | Verify existing handoff and prepare cohort experiment | Which first value/public product to select |
| Printing | Truthful current-PDF/system-sheet handoff | Unattended physical printer integration |

## Maintaining this document

Update the linked issue when a slice is advanced, split, shipped, rejected or superseded. Keep this file for source intent and evidence rather than duplicating live issue status. Replace each unfixed/escalated observation with its actual shipping and verification receipt when complete; do not erase historical cause or claim an untested adjacent journey works.

This review was prepared in the isolated `codex/gh-1087-sep5-feedback-review` worktree. All 26 items have issue homes, including explicit decision issues for deferred concepts. Local source-link validation, all F01-F26 references and the no-em-dash rule are checked after editing. The previous full `check:docs` failure was reproduced without this file and concerned existing manifest/reconciliation/migration evidence; no repository-wide documentation cleanup is claimed here.

The audit now traces every listed outcome through its relevant active paths or identifies the missing contract for a future concept. It distinguishes code verification, actual records, replayed outcomes and physical/model journeys still awaiting validation. It does not claim all repairs have shipped or all proposed capabilities are already certified.
