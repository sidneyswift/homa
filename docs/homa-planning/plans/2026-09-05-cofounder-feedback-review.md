# September 5 co-founder feedback: review and proposed tickets

Prepared September 6, 2026. Review owner: Sidney. Review issue: [#1087](https://github.com/sidneyswift/homa/issues/1087).

**The main request is to make Homa dependable with the work these families already do.** Record every real learning activity, let the parent correct the record directly, make progress updates easy to initiate, use the curriculum she already owns, and produce pages she can actually teach from. A generic worksheet alone does not capture the value described in these meetings.

This is a review document, not approval to build every idea below. GitHub Issues hold live status, priority, and ownership. The classifications and evidence here are a September 6 snapshot. The numbered F-items are reading references within this document, not another issue tracker.

## Read this first

- **Bounded work we can start today:** repair the deeper-question handoff and Binder layout; connect Day/Week recorded time to the existing editor; add child/date export filters; correct inconsistent school-year windows; investigate the remaining time collisions; improve specific recording and material-generation behavior.
- **Already exists, but incomplete or hard to discover:** child filtering, deletion, custom labels under any Hours subject, manual reported-time editing, parent-requested progress check-ins, per-child recorded-day arithmetic in state packs, curriculum retrieval/mapping tools, and the native print sheet.
- **Needs a small product decision:** reusable subcategory behavior, numeric progress presentation across web/native, what family-wide time means when one child is absent, and when Homa should ask follow-up questions.
- **Future concepts or experiments:** automatic whole-year scheduling from owned curricula, holiday-aware finish-date calculations, recurring assessments, quick versus deeply tailored creation, unattended printing, and a narrower public product/funnel.

“Today” means a bounded implementation or investigation can begin with the current architecture. It does not mean all these items fit in one day, that a fix is already shipped, or that an uncertain root cause has been proven.

### Live failures requiring attention

| Failure | September 6 evidence | Tracking and disposition |
|---|---|---|
| Deeper questions open ordinary chat and lose the request | Reproduced in an authenticated production test session; deployed route drops `dd` | [#1088](https://github.com/sidneyswift/homa/issues/1088). **ESCALATED September 6, not fixed.** |
| Two uploaded curricula cannot be processed or read | Two September 5 originals, 41.3 and 47.2 MiB, have `content_too_large_to_process`; the read tool returned `not-ready` | [#1089](https://github.com/sidneyswift/homa/issues/1089). **ESCALATED September 6, not fixed.** |
| School-year totals use different windows; distinct-time loss may remain | UI starts July 1, chat August 1, state records use the family setting. Two recent reading calls were suppressed as duplicates, but whether they were distinct work remains unproven | [#1090](https://github.com/sidneyswift/homa/issues/1090). **ESCALATED September 6. Date inconsistency is a deployed defect; additional lost blocks are suspected.** |
| Binder Delete is outside the visible mobile action row | Demonstrated in the meeting; deployed two-column shelf and non-wrapping actions fit the reported mechanism | [#1091](https://github.com/sidneyswift/homa/issues/1091). **ESCALATED September 6. Reported live, source corroborated; populated mobile shelf not independently reproduced.** |

No fix or delay has been approved through this document. These are explicit escalations, not claims that recording a ticket resolves the production failure. This pass created the requested evidence and review artifact; it did not change product code or repair family data.

## What was actually said

Sources:

- **P: Homa planner feedback**, September 5. [Original transcript](/Users/sidneyswift/.codex/attachments/e6287453-0982-40f4-87d3-868a8c131303/pasted-text.txt). Line references below use this file.
- **R: Progress report issues**, September 5. [Original transcript](/Users/sidneyswift/.codex/attachments/91b92cfb-992c-43a0-a02b-75cb3e52f54b/pasted-text.txt).
- **B: Binder organization: delete options**, September 5. Pasted directly into this task. The key sequence is: delete requested, hidden Delete discovered by scrolling sideways, deletion succeeds, then child filtering is discovered and works.

The speaker labels are anonymous and the headers list only Sidney. I have not guessed which A/B/C label belongs to Alessa or Carolyng. Product names are normalized to Homa in this document. The meeting metadata supplies the date; conversational references to August are not used to date an incident.

The meetings contain genuine disagreement that should remain visible:

- One parent values immediate follow-up while the lesson is fresh. Another would find repeated probing across three children exhausting.
- One proposed simplifying the public app to one dependable capability. Another said the broader assistant, personalization, and reduction in planning work were her reason to use Homa.
- The group considered deleting curriculum upload, then described in detail why using already-purchased curricula matters. **There was no settled instruction to remove Library or replace families' curricula.**
- Weekly, fortnightly, monthly, and quarterly check-ins/tests were discussed. **No single cadence was agreed.**
- Sidney explicitly said to put months back in the progress presentation. That is a concrete direction; its exact web/native scope and treatment of uncertain measurements still need definition.

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
| Carolyng's progress | Two `subject_deep_dive` check-ins completed September 5 | Check-ins can work through chat; this does not show the broken button works or that the assessment reached the right frontier |
| Carolyng's Hours since September 2 | 48 saved entries, 2 with custom labels. Two `log_hours` reading calls on September 3 and 4 returned the already-recorded receipt | Labels are being used, but rarely in this sample. Suppression is observed; erroneous suppression still needs source-turn reconciliation |
| July Hours across non-sandbox families | 51 rows across 3 families, totaling 2,229 minutes | The July/August window disagreement has real data to affect |

Methods: read-only Vercel CLI/API inspection, Git comparison, read-only Supabase queries, source tracing, existing issue history, and browser navigation. The older July production-baseline document was treated as historical. No model eval, generation job, outbound message, migration, data replay, or deployment was run.

Limitations: the browser session was a test family, not either interviewee's session; the exact failing handwriting artifacts and affected device viewports were not inspected; installed iOS/OTA state was not verified. Family diagnostics were filtered by the named parent and sandbox flag. Alessa's name matched two non-sandbox family records, so I have not presented name-grouped counts as one verified Alessa account.

## Ticket index

| Ref | Requested outcome | Classification | Tracking |
|---|---|---|---|
| F01 | Edit recorded time directly from Day/Week | Build today | [#1092](https://github.com/sidneyswift/homa/issues/1092) |
| F02 | Keep book titles and lesson details in the saved note | Improve and measure today | #1092 |
| F03 | Count separate same-subject activities correctly | Investigate/fix today | [#1090](https://github.com/sidneyswift/homa/issues/1090) |
| F04 | Reusable subcategories under stable parent subjects | Existing partial support; next feature slice | [#1035](https://github.com/sidneyswift/homa/issues/1035), [#1059](https://github.com/sidneyswift/homa/issues/1059) |
| F05 | Use curriculum-familiar subject names | Small display change after scope review | #1092 |
| F06 | Export one child between chosen dates | Build today | #1092 |
| F07 | Show/export recorded days per child | Existing arithmetic; bounded exposure today, absence policy decision | #1092, #1087 |
| F08 | Consistent school-year totals | Fix today | #1090 |
| F09 | Deeper questions start the requested check-in | Fix today | [#1088](https://github.com/sidneyswift/homa/issues/1088) |
| F10 | Assess demonstrated level beyond the age baseline | Investigate today before changing scoring | #1088, #1087 |
| F11 | Restore meaningful numeric progress context | Founder direction; presentation scope decision | #1087; historical [#625](https://github.com/sidneyswift/homa/issues/625) |
| F12 | Understand the abilities map and its evidence | Improve existing explanation today | #1092 |
| F13 | Clarify mastery without interrogating every log | Bounded skill improvement, cadence decision | #1092, #1087 |
| F14 | Offer a useful next step after saving progress | Bounded skill/handoff improvement | #1092 |
| F15 | Periodic progress review or assessment sheets | Future experiment requiring cadence/consent choice | #1087; historical [#401](https://github.com/sidneyswift/homa/issues/401) |
| F16 | Make accepted curriculum PDFs readable | Repair investigation today; full-book support is larger | [#1089](https://github.com/sidneyswift/homa/issues/1089) |
| F17 | “Lesson 12” uses the right owned curriculum | Prove an existing workflow first; bounded integration work | #1087, #1089; historical [#578](https://github.com/sidneyswift/homa/issues/578), [#579](https://github.com/sidneyswift/homa/issues/579) |
| F18 | Suggest relevant owned books and connected activities | Small proof possible today; broader concept unvalidated | #1087 |
| F19 | Handwriting pages have correct geometry and usable practice | Quality correction today, tied to exact failed artifact | [#1080](https://github.com/sidneyswift/homa/issues/1080), [#1066](https://github.com/sidneyswift/homa/issues/1066) |
| F20 | Choose speed versus deeper personalization | Future UX/performance experiment | #1087 |
| F21 | See Binder Delete on a phone | Fix today; delete already exists | [#1091](https://github.com/sidneyswift/homa/issues/1091) |
| F22 | Discover child filtering in Hours and Binder | Existing capability; teach/reveal today | #1092 |
| F23 | Understand dictation versus talking with Homa | Existing capability; clarify controls today | #1092 |
| F24 | Breaks, target finish dates, and a year of owned lessons | Future planning capability using existing foundations | #1087 |
| F25 | Pick a compelling first value and public rollout scope | Product/funnel decision and experiment | [#1053](https://github.com/sidneyswift/homa/issues/1053), [#1045](https://github.com/sidneyswift/homa/issues/1045), #1087 |
| F26 | Print through the app or automatically to a printer | Print sheet exists; unattended printing is future | #1087 |

## Concrete fixes and near-term improvements

### F01. Open and edit recorded time from Day and Week

**Heard:** P14-20. The parent wants to tap a day's entry, read its full note, and make a quick correction without searching School hours or asking in chat.

**Current:** `RecordedHours` in [unified-planner-view.tsx](../../../apps/web/app/app/planner/unified-planner-view.tsx) renders static list items with truncated notes. [HoursEntryOverlay](../../../apps/web/app/app/hours/hours-entry-overlay.tsx) already edits subject, custom label, date, minutes, and note. Existing Planner activity-detail editing is a different path, shipped under #1014/#1059.

**Smallest change:** open that existing Hours editor from the recorded-time row and preserve the selected date/view. **Done when:** a note can be read and edited from Day and Week, changes survive refresh, linked totals agree, and cancellation leaves the record intact. Reuse the write path rather than creating a second kind of time record.

### F02. Preserve useful detail in the original saved note

**Heard:** P18-20. Homa sometimes summarizes away a named book even though the parent supplied it.

**Current:** Hours has durable `note`; Planner learning records also carry notes and source quotes. The storage can hold the detail. The exact omission in the meeting has not been matched to its original message.

**Smallest change:** inspect a few affected source/record pairs, then improve the relevant logging skill's rule for retaining named books, lesson numbers, chapters, and activity distinctions. **Done when:** representative narrated logs retain those supplied facts without invented details. This is model judgment plus exact record validation, not a keyword extractor. F01 provides the parent's direct correction path even when the first summary is imperfect.

### F03. Count distinct activities, preserve true deduplication

**Heard:** P36-56. Portuguese after Spanish, and independent reading after curriculum reading, must still count as real time.

**Current:** #1059 already expanded custom labels and included them in the database uniqueness key. The live key is family + child + date + subject + minutes + custom label. Two distinct activities with identical values, especially no label, can still collide. The tool returns `logged: true` with an already-recorded receipt, so tool completion alone is not evidence of a new row.

**Next:** reconcile the two observed suppressed reading calls with their source turns and existing entries. **Done when:** separately named Spanish/Portuguese and independent/curriculum reading both save, repeated delivery of the same event saves once, and any recovery names the exact missing blocks. Do not remove deduplication or replay historical logs wholesale. Label management and correct event identity are related but separate problems.

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

**Current:** [state-pack derivation](../../../apps/web/lib/compliance/pack.ts) already groups recorded time into one row per child/date and prints per-child Recorded days and Saved time. [The pack route](../../../apps/web/app/api/compliance/pack/route.ts) supplies those records. The [state-records summary](../../../apps/web/lib/compliance/state-records.ts) also counts family-level days with logged time. This pass did not generate or inspect a fresh pack PDF.

**Gap:** these are not a standalone per-child attendance editor/export. A family-wide row currently counts for every child. No recorded time cannot safely mean absent. A child can also do school without timed work being logged.

**Smallest change:** expose the existing recorded-day calculation alongside F06, clearly labeled as days with recorded learning. **Decision before stronger attendance claims:** how to exclude one child from a shared activity, record an untimed school day, and correct an attendance day. **Done when:** the sick-child example yields the correct separate counts and repeat activities on one day count as one day.

**Additional defect found:** [UI totals](../../../apps/web/lib/hours-view.ts) use July 1, [chat totals](../../../apps/web/lib/hours-summary.ts) use August 1, and state records use `school_year_start_on`. Fix this under #1090 before presenting one authoritative school-year total. Acceptance includes configured start dates, year-round schooling, and a documented common fallback.

### F09-F10. Start deeper questions, then test the actual assessment boundary

**Heard:** R14-21. The button opens chat without a question; manually asking sometimes produces only one question and reassurance about age instead of locating what the child can do.

**Current:** [ProgressDetailPanel](../../../apps/web/components/progress/progress-detail-panel.tsx) links to `/onboarding?dd=...`; [onboarding](../../../apps/web/app/onboarding/page.tsx) redirects completed families to `/app` and loses that intent. This route failure is reproduced live. Existing `manage_child_progress` and [check-in service](../../../apps/web/lib/child-progress/check-in-service.ts) already support subject check-ins, and Carolyng completed two on September 5.

**Assessment distinction:** [question planning](../../../packages/core/src/map/bank.ts) selects an age-based starting point and harder ladder questions, with scope/rung limits; it is not simply “stop at chronological age.” The [selection code](../../../apps/web/lib/child-progress/check-in-selection.ts) also responds to existing answers. One question may reflect limited remaining bank coverage, a valid stop, or a routing/selection problem. The meeting alone does not resolve which.

**Done when:** the button preserves child and subject, produces a first question, and the fine-motor/music examples are checked against actual remaining eligible questions. Test an advanced child, a child needing easier questions, an already-answered ladder, and an exhausted bank. Explain coverage honestly rather than giving an age-level reassurance or inventing extra measurement precision.

### F11-F12. Numeric context and a comprehensible abilities map

**Heard:** R20-36. “Clear strength” no longer supplies the numeric context the parent valued, and she does not understand what the map's dots and connections represent.

**Current:** the [trajectory chart](../../../apps/web/app/onboarding/r/[token]/trajectory-chart.tsx) still plots numeric month values internally but presents labels such as A clear strength and an age reference. [Other tile code](../../../apps/web/lib/child-progress/map-model.ts) can still expose a numeric label. Native month/verdict pills were deliberately removed in #625, so web and native must be considered separately.

**Numeric proposal:** honor Sidney's September 5 direction with a defined presentation of existing, supported numbers. Before implementation, specify whether that applies to web detail, full report, native, or all three. Include unknown, sparse, capped, conflicting, and below-age evidence; do not invent a number or introduce a “behind” verdict. This is display policy, not permission to change the scorer.

**Map proposal:** improve the existing explanation at the point of use. The live web page already explains dots, the age band, prerequisite connections, and parent-answer provenance. [The map projection](../../../apps/web/lib/child-progress/abilities-explorer.ts) derives statuses from saved evidence, not minutes. **Done when:** a parent can explain known / working on / not yet observed, the age band, and prerequisites without a founder explaining the diagram, and can open the evidence or appropriate follow-up for one ability. Do not build another map.

### F13-F15. Progress capture, next steps, and recurring review

**Heard:** R37-120. A lesson number is not proof of mastery. Ask a useful clarification when needed, let the parent confirm progress, and offer help after an update. Periodic review was suggested, but the acceptable interruption burden differed sharply.

**Current:** the [Planner skill](../../../apps/web/agent/skills/planner/SKILL.md) explicitly separates completion from mastery. The progress tool validates quoted evidence; [progress-next-move](../../../apps/web/agent/skills/progress-next-move/SKILL.md) already defines one evidence-based next action. The old automatic weekly proposal #401 was closed without shipping that new recurring beat, pending demand/cadence evidence. These meetings provide new demand, not an agreed schedule.

**Near-term slice:** after logging, ask one relevant clarification only when the meaning would change the saved progress claim. “We moved on” should not become mastery without support. After a saved progress update, offer one optional practice, extension, or targeted lesson using the existing tools. **Done when:** minutes and completion never raise mastery by themselves; the parent can decline or say “not yet”; three children do not trigger an interrogation; the suggested next step matches the saved skill.

**Future decision:** immediate versus end-of-week review, monthly reminders, or periodic assessment sheets. Choose cadence, per-child scope, opt-in/stop behavior, and whether the task is a parent observation or an actual assessment. No new outbound schedule, weekly test, grading promise, or automatic credit assignment is authorized by this meeting.

### F16-F18. Read the curriculum, use the right lesson, and connect owned resources

**Heard:** R37-67, R120-179, R301-318. Large scanned teacher books fail; smaller saved curricula often act like stored copies. The parent wants “lesson 12” to mean the correct lesson for the correct child, followed by extra practice or a different activity. For an apple theme, she wants relevant owned books and curriculum activities surfaced without having to name file paths.

**Current:** Library upload accepts 500 MiB. [Automatic processing](../../../apps/web/lib/library/family-asset-processing.ts) limits bytes to 32 MiB, initial PDF classification to 120 pages/64,000 characters, and uses PDF text extraction. An image-only PDF cannot be assumed readable just because it is stored. The separate curriculum reader has its own bounds, including 240 source segments, and returns at most eight segments per call.

**Confirmed failure:** two September 5 originals exceed the processing byte cap; one actual reader call was refused as not Ready. Raising only the upload limit or marking a file Ready would not make it readable.

**Existing foundations:** [family-librarian](../../../apps/web/agent/skills/family-librarian/SKILL.md), `find_family_assets`, `get_family_asset`, [read_family_curriculum](../../../apps/web/agent/tools/read_family_curriculum.ts), and [curriculum-mapping](../../../apps/web/agent/skills/curriculum-mapping/SKILL.md) already retrieve, cite, propose units, and append approved work to existing Planner weeks. Mapping requires a ready original, a saved child assignment, source evidence, and Homa Plus. It is not automatic mapping upon upload. Carolyng has no saved derived units or approvals in the inspected data.

**Today:** scope a bounded repair for the actual failed sizes, then prove one ready source, one child, one numbered lesson, and one targeted output. Distinguish an unreadable source from a missing child assignment, wrong edition, incomplete source read, or skill-routing failure. Keep precise page/lesson provenance and report partial reading honestly.

**Done when:** the parent asks for her named lesson without restating its whole content; Homa opens the correct owned source, cites the lesson/page, and produces matching practice or an alternative activity. Lesson completion still does not prove mastery. For proactive resource connections, start with the specific apple/book example and show which saved sources actually informed the result.

**Larger scope:** durable complete-book understanding and automatic school-year scheduling are not established by the existing monthly mapping tools. Do not promise them as already working, and do not remove curriculum upload based on the tentative suggestion in R62.

### F19-F20. Usable handwriting and a speed/quality choice

**Heard:** R145-181, R312-322. The letters should fit their guides; examples already supplied do not have the generated mistakes. In a rush, a parent used a Google worksheet instead. She may wait longer for richer personalization when preparing ahead.

**Current:** [materials-studio](../../../apps/web/agent/skills/materials-studio/SKILL.md) already requires an SVG guide-row recipe for letters on writing guides. A separate [letter/number formation recipe](../../../apps/web/agent/skills/materials-studio/references/recipes/letter-number-formation-practice.md) moved to image-direct on September 2. #1080 already records formation-page problems, including mismatched reference content, practice sizing, and missing independent work; #1066 covers measured per-format consistency.

**Today:** identify the exact failed artifact and its recipe/rendering path, then improve that recipe/reference/reviewer loop. **Done when:** uppercase, lowercase, trace, and independent practice match the intended curriculum format, letter geometry aligns with the guides or boxes, and the final PDF is inspected at print size. More uploaded examples alone are not a fix. Preserve separate tests for choosing the right reference and rendering it correctly.

**Future UX experiment:** quick useful first output versus a slower source-grounded packet. The spoken two/eight-minute figures are hypothetical choices, not measured latency targets. Measure actual wait/revision/abandonment first. Test a remembered preference or optional deeper follow-up before asking the same speed question on every request.

### F21-F23. Make existing controls discoverable

**Binder Delete, B:** deletion worked once discovered. Fix the [material shelf](../../../apps/web/app/app/binder/in-progress-shelf.tsx) action layout at phone widths; retain the current delete/confirmation implementation. The separate [Month plans shelf](../../../apps/web/app/app/binder/working-plan-shelf.tsx) has different controls and is not established as the transcript's target. **Done when:** Keep, Open, Delete, and confirmation fit without sideways scrolling at 320/375/390 CSS pixels.

**Child filtering, P22 and B:** both requests were resolved in the meeting by discovering an existing switcher. [Hours scoping](../../../apps/web/lib/hours-view.ts) keeps the selected child's rows plus family-wide rows; Binder follows the same general view-context pattern. Improve the visible selected-child cue and brief contextual guidance, then verify both scopes. A social/onboarding explanation is an optional distribution idea; it is not a ticket to build another filter. Export scoping remains the separate F06 gap.

**Voice, R202-219:** the parent uses voice dictation in chat and did not know the other control starts a spoken conversation. Production has both “Talk instead of typing” and “Talk with Homa.” Clarify [dictation](../../../apps/web/app/app/dictation.tsx) and [voice mode](../../../apps/web/app/app/voice-mode-button.tsx) affordances and recording state. **Done when:** a parent can intentionally choose dictated text or a spoken conversation without relying on red/blue button descriptions. This is not a request to replace the voice model or make every dictated message receive a spoken reply.

## Future concepts and product decisions

### F24. Holidays, finish dates, and the year built from an owned curriculum

**Heard:** P86-98; R296-318. Remember breaks, calculate a likely finish date, compress or extend work, and place owned lessons on the calendar for the rest of the year. Adapt a difficult lesson into a narrative, discussion, hands-on activity, or a week of practice.

**Foundations already present:** family events/recurrence, school-year start settings, Planner scheduling, curriculum unit previews, and material/lesson-packet creation. **Missing complete product contract:** teaching-day rules, per-child attendance, holiday exceptions, remaining-lesson estimates, what may move, parental approval of changes, and horizon beyond current monthly plans.

**Proposed next proof:** one child, one already-readable curriculum, one existing month, and one announced break. Preview the affected dates and work before saving. Only then expand to a year. Preserve original lesson identity and the parent's curriculum choices. Chat and settings can both feed durable records; the meeting did not settle that interface choice.

State-specific day/hour requirements and “on schedule” claims require current, reviewed rule data for the actual family pathway. The transcript's example of 180 days is not treated here as a verified requirement for any state.

### F25. The first value, the public product, and a gradual rollout

**Heard:** R182-201, R221-299. Possible focus: personalized printables, a complete lesson packet, planning/logging, or a progress report that immediately produces a useful next week. Consider a narrower mobile offer, a founder-only experimental surface, then broader features after proving reliability. Progressive onboarding should collect more context as value becomes clear.

**What is strong evidence:** both parents describe using dictated logs; one says she no longer uses her old planner. A parent wants her chosen curriculum respected and values personalized lesson packets over generic worksheets. The other used an outside worksheet when time was tight. These are concrete behaviors and constraints.

**What remains a hypothesis:** that printables alone will attract and retain families; that a report plus a free week will convert; that simplifying the public app will beat the broader assistant; that the next school-year buying cycle dictates the whole roadmap. Meeting figures about signups, completion, and paid accounts are recollections, not freshly verified funnel metrics.

**Reuse:** #1053 already investigates onboarding completion without retention; #1045 owns current mobile onboarding/paywall work. Do not launch a competing rebuild, promise a free week, change pricing, remove existing features, or create a founder-only environment from this transcript alone.

**Smallest decision:** select one first-session outcome to test against the existing cohort. Compare return/use/payment behavior, not just excitement about the concept. Keep older-child discussion questions, teacher guidance, and hands-on activities in the definition of a lesson packet. A whole personalized week is larger than the existing single-next-move offer in F14.

### F26. Printing

**Heard:** R230-256. The tangible printed result may be the magic moment; an app could make printing easier, or material could simply appear at the printer.

**Current:** [native Binder](../../../apps/mobile/src/features/binder/material-detail-modal.tsx) already has a Print it action and a system print-sheet path. Source presence does not certify the installed build or a physical printer. Web also exposes PDF print/download actions.

**Split:** verify the existing print-sheet journey as normal product quality work. Treat unattended printer delivery, saved printer destinations, and automatic physical printing as a separate future feature requiring explicit setup and supported-device decisions. The meeting did not authorize a new printer integration.

## Suggested order after this review

1. Repair F09 and F21, reconcile F03, and standardize F08. Establish the safe repair/recovery slice for F16 immediately because actual curricula are blocked.
2. Ship F01/F02 and F06 together as a reliable record workflow. Expose the existing recorded-day summary with honest scope under F07.
3. Prove the exact F17 owned-lesson journey and fix the specific F19 handwriting failures. Add only the smallest necessary clarification and next-step behavior.
4. Resolve F04/F05 and F11, then test discoverability with the same parents. Choose a recurring-review cadence only after deciding the acceptable burden for multiple children.
5. Use #1053 to select the first-value experiment before investing in F24's full-year planner or changing the public product under F25.

## Decisions for Sidney to review

These are the unresolved choices exposed by the meetings, not questions that must all be answered at once.

| Decision | Proposed starting point | What remains open |
|---|---|---|
| Subject categories | Reusable family labels under fixed parent subjects | Whether categories belong to the whole family or can be child-specific; display names |
| Numeric progress | Restore supported numeric context where requested, retain evidence and uncertainty | Exact web/report/native scope and below-age presentation |
| Attendance | Call the first version recorded learning days | Untimed days, absences, and exclusions from family-wide activities |
| Progress prompts | One relevant in-session clarification; optional next step | When recurring reviews happen, for which child, and how to opt out |
| Curriculum scope | One correct owned lesson and useful follow-up first | Full-book processing appetite and full-year planning horizon |
| Product focus | Test a concrete useful outcome with actual returning behavior | Report-first, personalized packet-first, or logging/planning-first |

Review notes:

- Misunderstood or missing feedback:
- Items to implement first:
- Ideas to hold:
- Decisions made, with date and issue link:

## Keeping this useful

Update the linked issue when an item is approved, rejected, split, shipped, or superseded. Keep this document for intent, source evidence, and acceptance criteria. When a production fix ships, replace its escalation note with the commit, deployment, and live verification evidence. Do not mark it fixed from a merged PR or passing test alone.

The review lives in the isolated `codex/gh-1087-sep5-feedback-review` lane. It is a local review artifact, not a merged specification or a deployed change.

Verification of this artifact: all local source links resolve, the index contains 26 distinct feedback references, and no em dashes were introduced. The full `check:docs` gate fails on existing reconciliation/manifest/migration-evidence problems, reproduced with this new file temporarily excluded. This new review is also not registered in that historical manifest. No repository-wide documentation cleanup was attempted or claimed complete.
