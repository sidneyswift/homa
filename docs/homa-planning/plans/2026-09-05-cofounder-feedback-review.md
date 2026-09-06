# September 5 co-founder feedback: review and proposed tickets

Prepared September 6, 2026. Review owner: Sidney. Review issue: [#1087](https://github.com/sidneyswift/homa/issues/1087).

**Verification update, September 6:** the first pass verified deployed code, several database facts, and the broken deeper-question route. It assumed likely causes for missing notes, one-question check-ins and handwriting problems, and estimated which changes were small. The second pass checked the actual chat, records, rendered pages and selection functions. The corrections below supersede those assumptions.

**Correction after Sidney's deeper-questions challenge:** the earlier version traced the broken route and chat selector but did not distinguish the older dedicated deep-dive flow from the chat check-in. They use different question-selection algorithms and finish differently. F09-F10 now traces entry, selection, stopping, saved evidence and the resulting screen for both paths, with a comparison using Amalia's actual saved answers. A working link to the existing chat check-in would not by itself meet the reported need.

**Scope confirmed by Sidney:** Carolyng's feedback and feature requests concern the **mobile website**. The discussion about an app with fewer, focused features concerns the **native mobile app**. Native implementation details below are background, not evidence that a mobile-web complaint is already solved.

**Meaning confirmed by Sidney:** “months back” means a comparison such as a child being “15 months ahead” of national benchmarks. It does not mean restoring a generic date/month label. The requested concept is clear; the exact presentation and benchmark claim still need to match what Homa's scoring evidence supports.

**The main request is to make Homa dependable with the work these families already do.** Record every real learning activity, let the parent correct the record directly, make progress updates easy to initiate, use the curriculum she already owns, and produce pages she can actually teach from. A generic worksheet alone does not capture the value described in these meetings.

This is a review document, not approval to build every idea below. GitHub Issues hold live status, priority, and ownership. The classifications and evidence here are a September 6 snapshot. The numbered F-items are reading references within this document, not another issue tracker.

## Read this first

- **Bounded work we can start today:** repair the deeper-question handoff and Binder layout; connect Day/Week recorded time to the existing editor; add child/date export filters; correct inconsistent school-year windows; investigate the remaining time collisions; improve specific recording and material-generation behavior. The full deeper-assessment outcome also requires the F10 selection and completion review; it is not just the handoff repair.
- **Existing foundations, with the evidence limits below:** child filtering, deletion, custom labels under any Hours subject, manual reported-time editing, parent-requested progress check-ins, per-child recorded-day arithmetic, curriculum retrieval/mapping tools and web PDF print actions.
- **Needs a product decision:** reusable subcategory behavior, numeric progress presentation on mobile web, what family-wide time means when one child is absent, and when Homa should ask follow-up questions.
- **Future concepts or experiments:** automatic whole-year scheduling from owned curricula, holiday-aware finish-date calculations, recurring assessments, quick versus deeply tailored creation, unattended printing, and a narrower public product/funnel.

“Today” is an engineering scope estimate, not a verified delivery time. Existing code establishes possible starting points. No implementation, measured effort, end-to-end fix or shipping commitment has been verified. Future concepts and proposed acceptance criteria are proposals, not assumed current behavior or approved requirements.

### Live failures requiring attention

| Failure | September 6 evidence | Tracking and disposition |
|---|---|---|
| Deeper questions lose the request; manually started check-ins stop before exploring remaining abilities | Live route reproduction plus actual one-question sessions. Replaying both selectors shows chat stops where the older dedicated flow would continue | [#1088](https://github.com/sidneyswift/homa/issues/1088). **ESCALATED September 6, not fixed.** F09 and F10 require separate acceptance checks |
| Two uploaded curricula cannot be processed or read | Two September 5 originals, 41.3 and 47.2 MiB, have `content_too_large_to_process`; the read tool returned `not-ready` | [#1089](https://github.com/sidneyswift/homa/issues/1089). **ESCALATED September 6, not fixed.** |
| School-year totals disagree and distinct reading time is lost | Actual source turns confirm two separate 30-minute activities for Alma on September 3 were rejected against her literature journal. Local calls to the deployed date functions return July 1 versus August 1 | [#1090](https://github.com/sidneyswift/homa/issues/1090). **ESCALATED September 6, confirmed and not fixed.** At least these 60 minutes are absent from her Hours rows; this is not a complete historical recovery tally |
| Binder Delete overflows on phones | Actual deployed component and public production CSS reproduced with sample records at 320, 375 and 390 px. At 390 px, the second Delete ends at x=459.46 | [#1091](https://github.com/sidneyswift/homa/issues/1091). **ESCALATED September 6, not fixed.** This is a local layout reproduction, not a screenshot of Carolyng's authenticated Binder |
| Saved Hours notes lose supplied book titles | September 1 source/Hours comparison and September 4 source/tool/Hours comparison identify two different mechanisms | [#1093](https://github.com/sidneyswift/homa/issues/1093). **ESCALATED September 6 at 14:06 UTC, confirmed and not fixed** |
| Name-tracing geometry passes review despite a visible error | Actual September 1 rejected page inspected; model review passed, parent replied “Still wrong.” Later workaround changes mixed case to capitals | [#1094](https://github.com/sidneyswift/homa/issues/1094). **ESCALATED September 6 at 14:06 UTC, not fixed as a reusable mixed-case capability** |

No fix or delay has been approved through this document. These are explicit escalations, not claims that recording a ticket resolves the production failure. This pass created the requested evidence and review artifact; it did not change product code or repair family data.

## What was actually said

Sources:

- **P: Homa planner feedback**, September 5. [Original transcript](/Users/sidneyswift/.codex/attachments/e6287453-0982-40f4-87d3-868a8c131303/pasted-text.txt). Line references below use this file.
- **R: Progress report issues**, September 5. [Original transcript](/Users/sidneyswift/.codex/attachments/91b92cfb-992c-43a0-a02b-75cb3e52f54b/pasted-text.txt).
- **B: Binder organization: delete options**, September 5. Pasted directly into this task. The key sequence is: delete requested, hidden Delete discovered by scrolling sideways, deletion succeeds, then child filtering is discovered and works.

The speaker labels are anonymous and the headers list only Sidney. Speaker identities are not inferred from letters; Sidney's later clarifications establish platform scope and the intended benchmark comparison. Product names are normalized to Homa. The meeting metadata supplies the date; conversational references to August are not used to date an incident. Database timestamps below are explicitly UTC; the September 5 01:22-01:29 UTC check-ins occurred on September 4 in New York time.

The meetings contain genuine disagreement that should remain visible:

- One parent values immediate follow-up while the lesson is fresh. Another would find repeated probing across three children exhausting.
- One proposed simplifying the public app to one dependable capability. Another said the broader assistant, personalization, and reduction in planning work were her reason to use Homa.
- The group considered deleting curriculum upload, then described in detail why using already-purchased curricula matters. **There was no settled instruction to remove Library or replace families' curricula.**
- Weekly, fortnightly, monthly, and quarterly check-ins/tests were discussed. **No single cadence was agreed.**
- The requested numeric context is a months-ahead comparison, as Sidney confirmed in this task. That clarification establishes the concept, not an approval of a particular design, scoring change, or extension to native.

## Current production, verified separately from the repository

| Evidence | Observation | What it proves |
|---|---|---|
| Local Git | `main` and `origin/main` both at `1489c94f32ee20bfa1e97d3bcd53e749115ff58e`; primary checkout clean at inspection | Current repository baseline |
| Vercel live alias | `thankshoma.com` points to READY production deployment `dpl_HsiDZTZGnU4WHPiRxdzxWaNgjK3t`, created September 3, source `21b5ef4ac3bbaf57237488639c9486955c9d7757` | Which code is deployed on the web/backend |
| Diff from deployed source to local main | Only four native files differ: sign-in, settings, shared native UI, and an accessibility test | The web, agent, and database code inspected here matches the deployed source. It does not establish the installed iOS app version |
| Live database migration/index inspection | Custom labels under any subject and Planner reported-time RPC migrations are applied. The live Hours unique index includes `custom_label` | The September 2 fix is not merely sitting in a migration file |
| Authenticated production browser | Planner, Binder, Progress, and chat loaded in the existing Activation Test session. A child/subject `dd` URL landed on `/app`, showing the old conversation and empty composer | The deeper-check handoff failure reproduces today. No message or check-in answer was submitted |
| Carolyng's Library | 63 active top-level assets: 61 Ready and 2 Needs attention. Both failing originals were uploaded September 5 and exceed 32 MiB | A specific processing failure, not a general claim that Library never works |
| Carolyng's curriculum workflow | September 5 `read_family_curriculum` returned `read: false`, `error: not-ready`. No derived curriculum-unit rows or mapping approvals found for her family | The observed workflow has not reached usable lesson mapping. Ready metadata alone does not establish lesson comprehension |
| Carolyng's progress | Gross-motor and fine-motor check-ins each completed after exactly one response at 01:22 and 01:25 UTC September 5 | The one-question report is verified. Local selection replay explains the stop using existing answers and bounded ladders; it does not certify a measured developmental ceiling |
| Carolyng's Hours since September 2 | 48 saved entries, 2 with custom labels. Two `log_hours` reading calls returned the already-recorded receipt | Original messages and the existing rows now confirm erroneous suppression of distinct work, not retries |
| July Hours across non-sandbox families | 51 rows across 3 families, totaling 2,229 minutes | The July/August window disagreement has real data to affect |

Methods: read-only Vercel CLI/API inspection, Git comparison, read-only Supabase queries, source tracing, issue history, authenticated browser navigation/screenshots, actual saved worksheet previews, and local calls to existing pure functions. At Sidney's request, the second pass inspected 198 stored conversation messages from August 30 through September 6, including scheduled prompts, and corresponding Hours/tool records. The Binder layout fixture uses the real component and deployed CSS with sample records and disabled write actions. No new model eval, generation job, outbound family message, migration, production-data replay or deployment was run.

Limits: authenticated screenshots use the existing Activation Test family. Its Hours are empty and it has no in-progress materials, so these screenshots do not prove editing saves, populated export correctness or deletion against interviewee data. The populated Binder geometry was checked separately in the read-only fixture. Carolyng's actual name-tracing pages were inspected, but the literal D page mentioned in the meeting was not identified in her last-week records. The name-page failure corroborates the same guide problem without pretending it is that D artifact. Installed native/OTA state, physical printing, microphone audio, complete-book understanding and a live owned-lesson generation were not tested. They are not claimed working.

### What is verified versus still a proposal

**Code** means the deployed implementation was traced. **Live** means the current browser, saved production records or source messages were inspected. **Replayed** means existing code ran locally with stated inputs. **Reported** means a parent described it; this alone does not identify the cause. **Decision/estimate** is an explicitly proposed future behavior or scope judgment, not a fact needing to be made true by a screenshot.

These labels apply only to the behavior named in each row. They do not mean every feature has been traced or exercised end to end. A complete journey comparison needs the parent's intended outcome, actual entry point, active decision logic, durable effect, visible result and stop/failure behavior. F09-F10 now documents that code chain; its broken entry prevents a live run of the older flow. F17-F18 still lack a successful owned-lesson journey, F19 lacks the literal D artifact, and F23/F26 lack spoken/printed output. Future proposals have no completed implementation to certify.

| References | Verification result | Remaining limit or decision |
|---|---|---|
| F01 | Code: Day/Week rows are static; Hours editor fields and mutation path exist | Wiring is an estimate; save/cancel behavior of a new handoff cannot be verified before implementation |
| F02 | Live + code: two real missing-title examples and two causes traced | Historical prevalence and exact recovery scope not measured |
| F03 | Live + code: two distinct post-fix reading blocks suppressed; 60 minutes absent | Additional losses, including older Portuguese/English examples, need separate recovery reconciliation |
| F04-F05 | Code + live rows: custom labels exist; reusable category/filter/subtotal path does not | Proposed category ownership and display names remain decisions |
| F06 | Code + live UI: fixed `/api/hours/export` link persists after selecting Avery; route ignores filters | Proposed filtered export is not built; empty test-family CSV is not meaningful data validation |
| F07 | Code + replay: two activities on one day collapse to one child/day; a shared activity counts for both children | This proves recorded-day arithmetic, not absence handling, legal attendance or a fresh PDF |
| F08 | Code + replay + live July data: July/August starts differ | Which common fallback to adopt remains a policy choice |
| F09 | Live screenshot + code: server redirect loses `dd`; client chat branch also precedes the older deep-dive branch; `/app` has no `dd` handler | Fix still required; starting ordinary chat is not acceptance |
| F10 | Live responses + comparison replay: chat stops after catching/pouring, while the older deep-dive selector would next ask skipping/puzzle. Save, scoring and completion routes traced | Neither selector certifies the child's true level. Older flow also rebuilds a plan; restoring it unchanged is not an approved solution |
| F11 | Sidney confirmed months-ahead comparison; code exposes capped `monthsAhead` and signed `frontierDeltaMonths` separately | Exact UI and support for the wording “national benchmarks” are not settled by that clarification |
| F12 | Live + code: explanatory text and parent-evidence map exist | Whether improved wording helps these parents needs a usability check |
| F13-F14 | Code + real chat: evidence separation, clarification and next-step offers already happen | Reliability and preferred timing remain unmeasured; do not describe these as wholly missing features |
| F15 | Transcript + issue history: cadence proposals conflict; prior weekly proposal was cut | Cadence, consent and demand are decisions; no new recurring review is established |
| F16 | Live + code: two actual over-cap files fail processing and the reader refuses a not-ready source | Scanned-PDF text/OCR quality and complete-book coverage are separate unverified limits |
| F17-F18 | Code + live: tools exist; her Dimensions attempt asked for a fresh photo after source reading failed | Correct lesson-level/proactive output has not been demonstrated; feasibility is an estimate |
| F19 | Live chat, generation metadata and actual rendered name pages inspected | HTML name geometry is distinct from #1080's image-direct D probes; literal D artifact remains unidentified |
| F20 | Transcript: two/eight-minute choices are hypothetical | No latency promise, preferred default or measured quality tradeoff established |
| F21 | Report + code + local rendered geometry at three widths | Layout cause verified; no real material was deleted during this audit |
| F22 | Live: selected-child control changes to Avery; Binder copy scopes to Avery. Code scopes child plus shared records | Empty fixture cannot establish all populated-record cases; meeting supplies the real-parent filtering observation |
| F23 | Live screenshot + code: both controls and their distinct functions exist | Actual spoken turn and comprehension are untested; usability improvement is proposed |
| F24 | Code: component scheduling/mapping foundations exist | Full-year automatic planning, breaks and finish-date behavior are concepts, not current capability claims |
| F25 | Sidney confirmed native focus discussion; transcript establishes reported preferences | Funnel recollections have no defined cohort/window; conversion, retention and market-timing predictions remain hypotheses |
| F26 | Code + live chat: web Print action opens the PDF; native print-sheet path exists in source | No physical printing or installed-native certification; unattended delivery is a concept |

Screenshots in this task capture mobile School hours, child-scoped Binder, the failed deeper-question handoff, the local populated Binder fixture and saved worksheet pages. They support the specific observations above, not blanket certification of production.

## Ticket index

| Ref | Requested outcome | Classification | Tracking |
|---|---|---|---|
| F01 | Edit recorded time directly from Day/Week | Build today | [#1092](https://github.com/sidneyswift/homa/issues/1092) |
| F02 | Keep book titles and lesson details in the saved note | Confirmed bug; bounded repair investigation | [#1093](https://github.com/sidneyswift/homa/issues/1093) |
| F03 | Count separate same-subject activities correctly | Investigate/fix today | [#1090](https://github.com/sidneyswift/homa/issues/1090) |
| F04 | Reusable subcategories under stable parent subjects | Existing partial support; next feature slice | [#1035](https://github.com/sidneyswift/homa/issues/1035), [#1059](https://github.com/sidneyswift/homa/issues/1059) |
| F05 | Use curriculum-familiar subject names | Small display change after scope review | #1092 |
| F06 | Export one child between chosen dates | Build today | #1092 |
| F07 | Show/export recorded days per child | Existing arithmetic; bounded exposure today, absence policy decision | #1092, #1087 |
| F08 | Consistent school-year totals | Fix today | #1090 |
| F09 | Deeper questions start the requested check-in | Fix today | [#1088](https://github.com/sidneyswift/homa/issues/1088) |
| F10 | Assess demonstrated level beyond the age baseline | Confirmed mismatch between two assessment paths; repair scope needs review | #1088, #1087 |
| F11 | Restore a months-ahead benchmark comparison | Meaning confirmed by Sidney; presentation and evidence review | #1087; historical [#625](https://github.com/sidneyswift/homa/issues/625) |
| F12 | Understand the abilities map and its evidence | Improve existing explanation today | #1092 |
| F13 | Clarify mastery without interrogating every log | Bounded skill improvement, cadence decision | #1092, #1087 |
| F14 | Offer a useful next step after saving progress | Bounded skill/handoff improvement | #1092 |
| F15 | Periodic progress review or assessment sheets | Future experiment requiring cadence/consent choice | #1087; historical [#401](https://github.com/sidneyswift/homa/issues/401) |
| F16 | Make accepted curriculum PDFs readable | Repair investigation today; full-book support is larger | [#1089](https://github.com/sidneyswift/homa/issues/1089) |
| F17 | “Lesson 12” uses the right owned curriculum | Prove an existing workflow first; bounded integration work | #1087, #1089; historical [#578](https://github.com/sidneyswift/homa/issues/578), [#579](https://github.com/sidneyswift/homa/issues/579) |
| F18 | Suggest relevant owned books and connected activities | Small proof possible today; broader concept unvalidated | #1087 |
| F19 | Handwriting pages have correct geometry and usable practice | Actual HTML name-page failure verified | [#1094](https://github.com/sidneyswift/homa/issues/1094); related [#1080](https://github.com/sidneyswift/homa/issues/1080), [#1066](https://github.com/sidneyswift/homa/issues/1066) |
| F20 | Choose speed versus deeper personalization | Future UX/performance experiment | #1087 |
| F21 | See Binder Delete on a phone | Fix today; delete already exists | [#1091](https://github.com/sidneyswift/homa/issues/1091) |
| F22 | Discover child filtering in Hours and Binder | Existing capability; teach/reveal today | #1092 |
| F23 | Understand dictation versus talking with Homa | Existing capability; clarify controls today | #1092 |
| F24 | Breaks, target finish dates, and a year of owned lessons | Future planning capability using existing foundations | #1087 |
| F25 | Pick a compelling first value and public rollout scope | Product/funnel decision and experiment | [#1053](https://github.com/sidneyswift/homa/issues/1053), [#1045](https://github.com/sidneyswift/homa/issues/1045), #1087 |
| F26 | Print through the app or automatically to a printer | Web PDF link exists; physical output unverified; unattended printing is future | #1087 |

## Concrete fixes and near-term improvements

### F01. Open and edit recorded time from Day and Week

**Heard:** P14-20. The parent wants to tap a day's entry, read its full note, and make a quick correction without searching School hours or asking in chat.

**Current:** `RecordedHours` in [unified-planner-view.tsx](../../../apps/web/app/app/planner/unified-planner-view.tsx) renders static list items with truncated notes. [HoursEntryOverlay](../../../apps/web/app/app/hours/hours-entry-overlay.tsx) already edits subject, custom label, date, minutes, and note. Existing Planner activity-detail editing is a different path, shipped under #1014/#1059.

**Smallest change:** open that existing Hours editor from the recorded-time row and preserve the selected date/view. **Done when:** a note can be read and edited from Day and Week, changes survive refresh, linked totals agree, and cancellation leaves the record intact. Reuse the write path rather than creating a second kind of time record.

### F02. Preserve useful detail in the original saved note

**Heard:** P18-20. Homa sometimes summarizes away a named book even though the parent supplied it.

**Verified examples from Carolyng's last week:**

- September 1, 17:41 UTC: she named Make Way for Ducklings and its Spanish version. The later 40-minute `log_hours` call and saved Hours note described “Blossom and Root read-aloud and discussion plus word building” without either title. The title survived in the conversation and Planner summary, but was omitted from the Hours summary.
- September 4, 16:55 UTC: the `record_planner_activity` title included The Lion, the Witch and the Wardrobe, chapters 3-4. Its selected `sourceQuote` said only “today I read the following two chapters...” and all three children's 25-minute Hours notes contain that fragment without the title. [plannerHoursNote](../../../apps/web/lib/planner-learning-activities.ts) copies the first 200 code points of the quote rather than combining the readable title and note. The record bridge, not only the summarizing model, drops context.

**Correction to the first pass:** this is not merely a possible skill-writing improvement. #1093 covers both the model-generated summary and the deterministic Planner-to-Hours note format. Keep verbatim evidence separately from a useful parent-facing description. **Done when:** representative narrated logs retain supplied book titles, chapters, lesson numbers and activity distinctions in both paths, without invented details. F01 provides direct correction when the first saved record is imperfect.

### F03. Count distinct activities, preserve true deduplication

**Heard:** P36-56. Portuguese after Spanish, and independent reading after curriculum reading, must still count as real time.

**Current:** #1059 already expanded custom labels and included them in the database uniqueness key. The live key is family + child + date + subject + minutes + custom label. Two distinct activities with identical values, especially no label, can still collide. The tool returns `logged: true` with an already-recorded receipt, so tool completion alone is not evidence of a new row.

**Now verified:** on September 3 at 19:57 UTC, Carolyng reported Alma's independent reading of House of Secrets book 2 for 30 minutes. On September 4 at 16:54 UTC, she separately reported the previous day's 30-minute family read-aloud of The Lion, the Witch and the Wardrobe, chapters 1-2, with all three girls. Both calls returned the already-recorded receipt. Alma's September 3 Hours contain only the 30-minute literature journal and five-minute dictation, with neither new 30-minute activity. The original literature-journal message is also present. These are three different described activities, not duplicate deliveries. **At least 60 minutes from these two activities are missing from Hours.** Planner preservation does not repair an Hours total.

Earlier August 31/September 1 chats also explicitly distinguish IR English from Frindle and show a Portuguese/ABC Mouse collision, but those precede the September 2 fix and are not included in this 60-minute post-fix tally. **Done when:** separately named Spanish/Portuguese and independent/curriculum reading both save, repeated delivery of the same event saves once, and any recovery names the exact missing blocks. Do not remove deduplication or replay historical logs wholesale. Label management and correct event identity are related but separate problems.

### F04-F05. Subcategories and familiar subject names

**Heard:** P25-48. Keep broad subjects stable, add Spanish/Portuguese and independent/curriculum reading underneath, and show their time separately. Suggested names: Language arts, History and social studies, and Foreign language.

**Current:** [hours-view.ts](../../../apps/web/lib/hours-view.ts) displays Reading, Social studies, and Second language. Its language storage key is `spanish`, although the label is broader. Per-entry custom labels already work under any Hours subject on the web and through `log_hours`. There is no reusable family subcategory catalog or subcategory filter/total in the inspected path. The native Hours editor does not yet expose the web custom-label field.

**Proposal:** use #1035 for reusable child/family categories under a canonical parent, including rename/reuse/filter/subtotals. The September 2 work is the first slice, not completion of that issue. Display-name changes are small and can be reviewed separately; do not rename scoring IDs or pretend Hours Reading maps one-to-one to all literacy/writing skills. **Done when:** a parent can repeatedly choose the same subcategory, see both its own minutes and its parent total, and still obtain the same canonical progress evidence. Time never becomes a mastery score.

### F06. Child and date-range exports

**Heard:** P58-59. Choose a child and inclusive start/end dates, including a school year or a term, without manually separating siblings afterward.

**Current:** [export route](../../../apps/web/app/api/hours/export/route.ts) always loads the complete family record; it does not consume child/date query parameters. The download link is fixed even when the screen has a child filter. [hours-export.ts](../../../apps/web/lib/hours-export.ts) already creates an uncapped CSV with date, child, subject, minutes, hours, source, and note.

**Smallest change:** add authenticated child and date filters, with a visible export scope. **Done when:** only the selected child's eligible records in the inclusive window appear, invalid/reversed ranges are rejected, family-wide inclusion is explicit, and boundary dates work in the family's timezone. Keep full-family/full-history export available.

### F07-F08. Attendance and school-year consistency

**Heard:** P60-85. Count each child's school days independently, including days when a sibling is absent, and export the count for a chosen period.

**Current:** [state-pack derivation](../../../apps/web/lib/compliance/pack.ts) matches records to children and groups them by child display name/date, then prints per-child Recorded days and Saved time. Local replay with distinct child names verified that two entries on September 1 make one day for child A, while a shared September 2 entry adds one day to both A and B. That proves the intended arithmetic for this example; it does not certify distinct children with identical display names. [The pack route](../../../apps/web/app/api/compliance/pack/route.ts) supplies records; [state-records summary](../../../apps/web/lib/compliance/state-records.ts) counts family-level days. No fresh pack PDF or statutory attendance claim was verified.

**Gap:** these are not a standalone per-child attendance editor/export. A family-wide row currently counts for every child. No recorded time cannot safely mean absent. A child can also do school without timed work being logged.

**Smallest change:** expose the existing recorded-day calculation alongside F06, clearly labeled as days with recorded learning. **Decision before stronger attendance claims:** how to exclude one child from a shared activity, record an untimed school day, and correct an attendance day. **Done when:** the sick-child example yields the correct separate counts and repeat activities on one day count as one day.

**Additional defect found:** [UI totals](../../../apps/web/lib/hours-view.ts) use July 1, [chat totals](../../../apps/web/lib/hours-summary.ts) use August 1, and state records use `school_year_start_on`. Calling both existing date functions for September 6 returns `2026-07-01` and `2026-08-01` respectively. Fix this under #1090 before presenting one authoritative school-year total. Acceptance includes configured start dates, year-round schooling, and a documented common fallback.

### F09-F10. Deeper questions should locate demonstrated ability and update progress

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

**Scope:** #1088 records both the broken handoff and this confirmed behavior mismatch, still escalated and unfixed. Reuse the authenticated evidence-writing infrastructure. The assessment procedure and its stop criteria need a deliberate review; do not introduce another assessment store or assume a one-line URL change completes the capability.

### F11-F12. Numeric context and a comprehensible abilities map

**Heard:** R20-36. “Clear strength” no longer supplies the numeric context the parent valued, and she does not understand what the map's dots and connections represent.

**Current:** the [trajectory chart](../../../apps/web/app/onboarding/r/[token]/trajectory-chart.tsx) still plots numeric month values internally but presents labels such as A clear strength and an age reference. [Other tile code](../../../apps/web/lib/child-progress/map-model.ts) can still expose a numeric label. Native month/verdict pills were deliberately removed in #625, so web and native must be considered separately.

**Meaning confirmed by Sidney:** restore the concept of being “15 months ahead” of national benchmarks on the mobile-web progress experience. This is not just adding the word months to a chart.

**What the code actually computes:** [scoring.ts](../../../packages/core/src/map/scoring.ts) derives a frontier from parent answers and cited age anchors, adjusts documented age windows, then subtracts the child's age. Displayed `monthsAhead` is capped at the smaller of 24 months and approximately one-third of the child's age; `frontierDeltaMonths` is a separate signed value. A four-year-old's display cap is 16 months. Restoring numbers must distinguish the capped estimate, raw distance, sparse/unknown evidence and beyond-scale results. The implementation is not evidence that the resulting number is a validated national test score. The precise benchmark description and placement in web detail/full report remain to be reviewed. Native is not automatically included, and no scorer change or “behind” verdict is authorized here.

**Map proposal:** improve the existing explanation at the point of use. The live web page already explains dots, the age band, prerequisite connections, and parent-answer provenance. [The map projection](../../../apps/web/lib/child-progress/abilities-explorer.ts) derives statuses from saved evidence, not minutes. **Done when:** a parent can explain known / working on / not yet observed, the age band, and prerequisites without a founder explaining the diagram, and can open the evidence or appropriate follow-up for one ability. Do not build another map.

### F13-F15. Progress capture, next steps, and recurring review

**Heard:** R37-120. A lesson number is not proof of mastery. Ask a useful clarification when needed, let the parent confirm progress, and offer help after an update. Periodic review was suggested, but the acceptable interruption burden differed sharply.

**Current:** the [Planner skill](../../../apps/web/agent/skills/planner/SKILL.md) explicitly separates completion from mastery. The progress tool validates quoted evidence; [progress-next-move](../../../apps/web/agent/skills/progress-next-move/SKILL.md) already defines one evidence-based next action. The old automatic weekly proposal #401 was closed without shipping that new recurring beat, pending demand/cadence evidence. These meetings provide new demand, not an agreed schedule.

**Verified in actual use:** the last-week chat already contains clarification and optional next-step offers. After the motor check-ins, Homa offered cutting practice; Carolyng said the suggested work was already easy. It then asked about curves/zigzags and offered a more specific page. F13-F14 are therefore improvements to accuracy, timing and consistency, not wholly absent features. The chat also contains observations saved without a matched score change, so “noted” is not proof that the progress graph changed.

**Near-term proposal:** after logging, ask one relevant clarification only when the meaning would change the saved progress claim. “We moved on” should not become mastery without support. After a saved progress update, offer one optional practice, extension or targeted lesson using the existing tools. **Done when:** minutes and completion never raise mastery by themselves; the parent can decline or say “not yet”; three children do not trigger an interrogation; the suggested next step matches current evidence rather than a stale answer.

**Future decision:** immediate versus end-of-week review, monthly reminders, or periodic assessment sheets. Choose cadence, per-child scope, opt-in/stop behavior, and whether the task is a parent observation or an actual assessment. No new outbound schedule, weekly test, grading promise, or automatic credit assignment is authorized by this meeting.

### F16-F18. Read the curriculum, use the right lesson, and connect owned resources

**Heard:** R37-67, R120-179, R301-318. Large scanned teacher books fail; smaller saved curricula often act like stored copies. The parent wants “lesson 12” to mean the correct lesson for the correct child, followed by extra practice or a different activity. For an apple theme, she wants relevant owned books and curriculum activities surfaced without having to name file paths.

**Current:** Library upload accepts 500 MiB. [Automatic processing](../../../apps/web/lib/library/family-asset-processing.ts) limits bytes to 32 MiB, initial PDF classification to 120 pages/64,000 characters, and uses PDF text extraction. An image-only PDF cannot be assumed readable just because it is stored. The separate curriculum reader has its own bounds, including 240 source segments, and returns at most eight segments per call.

**Confirmed failure:** two September 5 originals exceed the processing byte cap; one actual reader call was refused as not Ready. Raising only the upload limit or marking a file Ready would not make it readable.

**Actual parent journey:** on September 5 at 01:42 UTC Carolyng asked for the first week's Dimensions lesson and worksheet from the teacher book. After the failed source read, Homa asked for a new photo of the lesson page. That verifies the blocked owned-source workflow. It does not prove that every Ready curriculum is unreadable, that child assignment is the cause of this attempt, or that raising the byte cap alone solves scanned books.

**Existing foundations:** [family-librarian](../../../apps/web/agent/skills/family-librarian/SKILL.md), `find_family_assets`, `get_family_asset`, [read_family_curriculum](../../../apps/web/agent/tools/read_family_curriculum.ts), and [curriculum-mapping](../../../apps/web/agent/skills/curriculum-mapping/SKILL.md) already retrieve, cite, propose units, and append approved work to existing Planner weeks. Mapping requires a ready original, a saved child assignment, source evidence, and Homa Plus. It is not automatic mapping upon upload. Carolyng has no saved derived units or approvals in the inspected data.

**Today:** scope a bounded repair for the actual failed sizes, then prove one ready source, one child, one numbered lesson, and one targeted output. Distinguish an unreadable source from a missing child assignment, wrong edition, incomplete source read, or skill-routing failure. Keep precise page/lesson provenance and report partial reading honestly.

**Done when:** the parent asks for her named lesson without restating its whole content; Homa opens the correct owned source, cites the lesson/page, and produces matching practice or an alternative activity. Lesson completion still does not prove mastery. For proactive resource connections, start with the specific apple/book example and show which saved sources actually informed the result.

**Larger scope:** durable complete-book understanding and automatic school-year scheduling are not established by the existing monthly mapping tools. Do not promise them as already working, and do not remove curriculum upload based on the tentative suggestion in R62.

### F19-F20. Usable handwriting and a speed/quality choice

**Heard:** R145-181, R312-322. The letters should fit their guides; examples already supplied do not have the generated mistakes. In a rush, a parent used a Google worksheet instead. She may wait longer for richer personalization when preparing ahead.

**Verified family artifact:** Carolyng's September 1 16:29 UTC message says Amalia's name worksheet puts the middle of the letters above the writing-guide midline. The 16:35 revision passed Homa's reviewer; at 16:39 she replied “Still wrong.” The actual [rejected mixed-case page](https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/families/304f0003-6c55-4c31-807a-941aff214283/materials/amalia-s-name-tracing-practice-A4D83SDt8CVucpAxN4O3mzEor87G9o.jpg) shows the capital A and tall letter strokes stopping below the top guide. Another revision failed review, then the [16:44 revision](https://pkvvudjdhxk33dig.public.blob.vercel-storage.com/families/304f0003-6c55-4c31-807a-941aff214283/materials/amalia-s-name-tracing-practice-bNHRnqVA5X0QQMN4lr4YvCq8cMF9tk.jpg) changed the name to all capitals. These existing previews were opened and visually inspected; no new page was generated or physically printed.

**Correction to the first pass:** the four revisions record `input.path: html`, with no explicit recipe recorded. They are not proven to have used the image-direct [letter/number formation recipe](../../../apps/web/agent/skills/materials-studio/references/recipes/letter-number-formation-practice.md) or #1080's D probe. [materials-studio](../../../apps/web/agent/skills/materials-studio/SKILL.md) does instruct guide-row construction, but having that instruction is not proof of correct rendered geometry. #1094 owns this actual family failure; #1080 and #1066 remain related quality work. The literal D example from the meeting is still unidentified, and no equivalence is assumed.

**Repair proposal:** verify font cap height, x-height, baseline and guide alignment, then test the actual rendering/reviewer path. A reviewer pass is not enough: this exact rejected page passed. Changing requested letter case is an alternative, not proof that mixed-case output is fixed. **Done when:** uppercase, lowercase, trace and independent practice match the intended format, geometry aligns with the guides, and the final PDF is inspected at print size. More uploaded examples alone are not a fix. Preserve separate checks for reference selection and rendering.

**Future UX experiment:** quick useful first output versus a slower source-grounded packet. The spoken two/eight-minute figures are hypothetical choices, not measured latency targets. Measure actual wait/revision/abandonment first. Test a remembered preference or optional deeper follow-up before asking the same speed question on every request.

### F21-F23. Make existing controls discoverable

**Binder Delete, B:** deletion worked once discovered in the meeting. The [material shelf](../../../apps/web/app/app/binder/in-progress-shelf.tsx) has two columns on phones and a non-wrapping action row. A read-only fixture rendered this actual component and production CSS with two sample records. At viewport widths 320 / 375 / 390 px, document widths were 424 / 452 / 459 px; the second Delete button extended to x=424.46 / 451.96 / 459.46. The 390 px screenshot also shows the first card's Delete overlapping the second card's Keep action. This verifies the layout mechanism. No family material was deleted. The separate [Month plans shelf](../../../apps/web/app/app/binder/working-plan-shelf.tsx) has different controls and is not established as the transcript's target. **Done when:** Keep, Open, Delete and confirmation fit without sideways scrolling or overlapping at all three widths.

**Child filtering, P22 and B:** both requests were resolved in the meeting by discovering an existing switcher. [Hours scoping](../../../apps/web/lib/hours-view.ts) keeps the selected child's rows plus family-wide rows; Binder follows the same general view-context pattern. Improve the visible selected-child cue and brief contextual guidance, then verify both scopes. A social/onboarding explanation is an optional distribution idea; it is not a ticket to build another filter. Export scoping remains the separate F06 gap.

**Live check:** at 390 px, choosing Avery changes the header's accessible label to “Viewing Avery” and Binder says “Everything kept for Avery, plus anything for the whole family.” The CSV link still points to the unfiltered endpoint. Those are verified UI observations; the test family's empty Hours do not prove populated filtered totals.

**Voice, R202-219:** the parent uses voice dictation in chat and did not know the other control starts a spoken conversation. Production has both “Talk instead of typing” and “Talk with Homa.” Clarify [dictation](../../../apps/web/app/app/dictation.tsx) and [voice mode](../../../apps/web/app/app/voice-mode-button.tsx) affordances and recording state. **Done when:** a parent can intentionally choose dictated text or a spoken conversation without relying on red/blue button descriptions. This is not a request to replace the voice model or make every dictated message receive a spoken reply.

## Future concepts and product decisions

### F24. Holidays, finish dates, and the year built from an owned curriculum

**Heard:** P86-98; R296-318. Remember breaks, calculate a likely finish date, compress or extend work, and place owned lessons on the calendar for the rest of the year. Adapt a difficult lesson into a narrative, discussion, hands-on activity, or a week of practice.

**Foundations already present:** family events/recurrence, school-year start settings, Planner scheduling, curriculum unit previews, and material/lesson-packet creation. **Missing complete product contract:** teaching-day rules, per-child attendance, holiday exceptions, remaining-lesson estimates, what may move, parental approval of changes, and horizon beyond current monthly plans.

**Proposed next proof:** one child, one already-readable curriculum, one existing month, and one announced break. Preview the affected dates and work before saving. Only then expand to a year. Preserve original lesson identity and the parent's curriculum choices. Chat and settings can both feed durable records; the meeting did not settle that interface choice.

State-specific day/hour requirements and “on schedule” claims require current, reviewed rule data for the actual family pathway. The transcript's example of 180 days is not treated here as a verified requirement for any state.

### F25. The first value, the public product, and a gradual rollout

**Heard:** R182-201, R221-299. Possible focus: personalized printables, a complete lesson packet, planning/logging, or a progress report that immediately produces a useful next week. **Sidney confirmed the narrower offer discussed here is for the native mobile app**, while Carolyng's operational feedback concerns the mobile website. A founder-only experimental surface and broader rollout were ideas, not approved architecture. Progressive onboarding was proposed to collect more context as value becomes clear.

**What is strong evidence:** both parents describe using dictated logs; one says she no longer uses her old planner. A parent wants her chosen curriculum respected and values personalized lesson packets over generic worksheets. The other used an outside worksheet when time was tight. These are concrete behaviors and constraints.

**What remains a hypothesis:** that printables alone will attract and retain families; that a report plus a free week will convert; that simplifying native will beat the broader assistant; that the next school-year buying cycle dictates the whole roadmap. Meeting figures about signups, completion and paid accounts do not specify a cohort/window, so they cannot be reconciled honestly to one production number. They are excluded from factual sizing or prioritization here. No claim that the meeting's numerical recollections are correct is made.

**Reuse:** #1053 already investigates onboarding completion without retention; #1045 owns current mobile onboarding/paywall work. Do not launch a competing rebuild, promise a free week, change pricing, remove existing features, or create a founder-only environment from this transcript alone.

**Smallest decision:** select one first-session outcome to test against the existing cohort. Compare return/use/payment behavior, not just excitement about the concept. Keep older-child discussion questions, teacher guidance, and hands-on activities in the definition of a lesson packet. A whole personalized week is larger than the existing single-next-move offer in F14.

### F26. Printing

**Heard:** R230-256. The tangible printed result may be the magic moment; an app could make printing easier, or material could simply appear at the printer.

**Current:** the mobile-web [Binder overlay](../../../apps/web/app/app/binder/material-detail-overlay.tsx) implements Print it / Print all pages as a link to the PDF in a new tab; the browser's PDF viewer handles printing/downloading. The authenticated chat also visibly exposes Print all 2 pages for the existing test worksheet. This verifies the action/link, not AirPrint or physical output. [Native Binder](../../../apps/mobile/src/features/binder/material-detail-modal.tsx) has a system print-sheet path in source, but the installed build and printer were not tested. Native presence is background and cannot close a mobile-web request.

**Split:** verify the existing print-sheet journey as normal product quality work. Treat unattended printer delivery, saved printer destinations, and automatic physical printing as a separate future feature requiring explicit setup and supported-device decisions. The meeting did not authorize a new printer integration.

## Suggested order after this review

1. Repair F09 and F21, review and repair F10's assessment behavior, reconcile F03, and standardize F08. Establish the safe repair/recovery slice for F16 immediately because actual curricula are blocked. Keep the deeper-question work open until both the handoff and assessment acceptance checks pass.
2. Ship F01/F02 and F06 together as a reliable record workflow. Expose the existing recorded-day summary with honest scope under F07.
3. Prove the exact F17 owned-lesson journey and fix the specific F19 handwriting failures. Add only the smallest necessary clarification and next-step behavior.
4. Resolve F04/F05 and F11, then test discoverability with the same parents. Choose a recurring-review cadence only after deciding the acceptable burden for multiple children.
5. Use #1053 to select the first-value experiment before investing in F24's full-year planner or changing the public product under F25.

## Decisions for Sidney to review

These are the unresolved choices exposed by the meetings, not questions that must all be answered at once.

| Decision | Proposed starting point | What remains open |
|---|---|---|
| Subject categories | Reusable family labels under fixed parent subjects | Whether categories belong to the whole family or can be child-specific; display names |
| Numeric progress | Restore the months-ahead comparison requested by Sidney on mobile web, grounded in existing evidence | Exact placement, capped versus raw values, benchmark wording and unknown/below-age handling; native extension is not assumed |
| Attendance | Call the first version recorded learning days | Untimed days, absences, and exclusions from family-wide activities |
| Progress prompts | One relevant in-session clarification; optional next step | When recurring reviews happen, for which child, and how to opt out |
| Curriculum scope | One correct owned lesson and useful follow-up first | Full-book processing appetite and full-year planning horizon |
| Product focus | Test a concrete useful first outcome for the focused native offer | Report-first, personalized packet-first or logging/planning-first; mobile web remains the surface of Carolyng's operational feedback |

Review notes:

- Misunderstood or missing feedback:
- Items to implement first:
- Ideas to hold:
- Decisions made, with date and issue link:

## Keeping this useful

Update the linked issue when an item is approved, rejected, split, shipped, or superseded. Keep this document for intent, source evidence, and acceptance criteria. When a production fix ships, replace its escalation note with the commit, deployment, and live verification evidence. Do not mark it fixed from a merged PR or passing test alone.

The review lives in the isolated `codex/gh-1087-sep5-feedback-review` lane. It is a local review artifact, not a merged specification or a deployed change.

Verification of this artifact: local source links, all 26 index references and the no-em-dash rule are checked after revision. The full `check:docs` gate previously failed on existing reconciliation/manifest/migration-evidence problems, reproduced with this new file temporarily excluded. This review is also not registered in that historical manifest. No repository-wide documentation cleanup is claimed.

No assumption is silently promoted to a verified fact: causes that were established now include evidence; unsupported artifact attribution was removed; scope and numeric meaning were clarified with Sidney; estimates, future product choices and tests requiring a real printer, microphone or new implementation remain explicitly unverified. This document does not claim that every capability or future proposal has been certified.
