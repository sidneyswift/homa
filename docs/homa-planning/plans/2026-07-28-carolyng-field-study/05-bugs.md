# Bug inventory

Per the prod-bugs ruling (`prod-bugs-fixed-not-stored`, 2026-07-14): every bug
here carries a status. Bugs confirmed live that could not be fixed in this
session are plainly escalated in the session's final reply to the founder; this
doc records the evidence. Existing-issue overlaps add evidence, they do not
re-file.

| ID | Severity | Status | Summary |
|---|---|---|---|
| FB-1 | P1 production | NEW, escalated | Web chat input truncates long messages (~1500 chars) |
| FB-2 | P1 production | Evidence to #197/#241/#175 | Draft stranding + finalize timeouts, meeting-day materials still draft |
| FB-3 | P1 production | NEW, escalated + data fixed in-session (see below) | Lesson recording misattribution: no reattribution path, agent blind to recordings |
| FB-4 | P1 production | Evidence to #170/#256, needs telemetry | Deliverable invisibility: repeated "where is it?" across sessions |
| FB-5 | P2 | NEW | Video/screenshot of text is summarized, not transcribed; reference images become unreadable to the agent later |
| FB-6 | P1 production | NEW (generalizes #198, #281) | In-call promises unfulfilled: 07-23 promised email never sent (0 email rows 07-23/24) |
| FB-7 | P1 production | NEW investigation | create_printable unavailable for stretches of 07-26/27; user told to report the bug herself; no operator alert |
| FB-8 | P2 production | FIXED in-session (rows deleted 2026-07-28) | 17 debug "Minimal Test"/"Diag" material rows inside a real family (07-23) |
| FB-9 | P1 | Evidence to #203 | Long assistant replies truncate mid-sentence (NYC itinerary twice) |
| FB-10 | P2 | NEW | Calls hear "Homa" as "Alma" (a child's name); transcripts store it; journaling misattribution hazard |
| FB-11 | P1 production | Evidence to #171/#278 | Cross-channel amnesia recurrences 07-23 and 07-25 (hours denial 3h after call) |
| FB-12 | P2 | NEW | QC claims "passed" against complaints it did not test (see F6 leg 2; tool-honesty adjacent) |

## Detail and receipts

**FB-1. Input truncation.** 07-25 17:12 web: her per-page edit list stored at
exactly 1502 chars, ending mid-word ("...image with petals for Amalia to count.
Fo"). Homa's reply independently confirms the cut. She then burned 20 minutes on
video/screenshot workarounds (FB-5). COUNCIL CORRECTION (06-council.md item 3):
no ~1500 constant exists anywhere in the composer, send policy, or write path
(persisted cap is 8000). The verified mechanism candidate is dictation:
MAX_RECORDING_SECONDS = 180 hard-stops recording and auto-accepts the mid-word
transcript (apps/web/app/app/dictation.tsx:48), invisible in the single-line
input. Fix is the F11 bundle: surface "Homa stopped listening", offer a second
take, and make long drafts visible end to end. Do not hunt a constant.

**FB-2. Draft stranding cluster.** 07-14: "I dont see Aras page in her binder"
(draft). 07-27 09:39: packet + syllable sheet invisible until she complained;
Homa finalized reactively. 07-28 07:42: finalize save "timed out" on two
materials, both still `draft` today (Ara rocket math launch, Alma Camp
Half-Blood). Meeting-day (07-28) Artemis, Kirby, Astro-Bot, and handwriting
sheets: all still `draft`. Evidence lands on #197 (approve/finalize gap), #241
(drafts invisible to find_materials), #175 (binder in-progress area).

**FB-3. Lesson recording misattribution.** 07-27 14:39-19:32: she asked three
times to move a recording from Alma to Amalia. Agent searched and answered "I
don't see any recording anywhere" while `lesson_recordings` held the row
(Alma, 07-27 18:06 UTC, 1665s, status ready). Root causes: (a) no agent tool
reads lesson_recordings; (b) no reattribution capability exists anywhere; (c)
recorder UI made mis-selection easy with look-alike names. The transcript
confirms she still wants this fixed. Data FIXED in this session (2026-07-28):
recording 64e488f0, its lesson_reviews row (child_id plus the five "Alma..."
progress-note clauses and summary prose), and evidence row 3897e3b6
(phonics.claps-syllables, which had wrongly scored the 9-year-old) all
reattributed to Amalia; the evidence update fired the designed revision-bump
trigger so projections recompute. The product capability (tool + reassign +
recorder UI) is F8 and still needs building.

**FB-4. Deliverable invisibility.** 07-16 14:40 "Where is my scavenger hunt?"
(that one was a real silent drop: Homa admitted "that one hadn't actually been
made yet" after first claiming it was ready). 07-23 17:28 "Where is it?". 07-27
20:49-22:02 "Alma packet" / "Where is almas packet" / "Where is it?" three times
after delivery. 07-28 12:40-12:53 same pattern for the handwriting sheet. Some
instances are render/paint (CG-06 #170 class, possibly mobile #256), some are
"card exists but user cannot find it" navigation. Needs per-turn delivery
telemetry (what card was emitted, did the client ack render), which #170 already
demands; this is the strongest usage evidence yet.

**FB-5. Multimodal text recovery.** 07-25 17:18: she sent a screen recording of
her own truncated message; the pipeline returned a generic scene summary and Homa
had to ask her to retype. The follow-up screenshot also went unread. 07-28 13:13:
Homa could not re-open her earlier reference photo ("it isn't loading on my
end"). Fix half in F11 (OCR intent), half in F1 (persist references).

**FB-6. In-call promise fulfillment.** 07-23 call (11:29 ET): promised a
curriculum-recommendations email with Yoto integration links and Amazon links,
"on its way soon". `email_sends` for 07-23/24: zero rows. She chased on SMS at
12:49 (Homa could not even find the call) and at 21:56 (got status narration, no
email; the narration also contradicted the call by re-scoping the ask). Separate
instance: 07-22 04:20 call promised trip-review worksheets for each girl; 8 hours
later 3 finals appeared but 2 of 3 were not trip content. The class: a promise
made on the phone has no ledger, no deadline, no recovery. F10 is the fix; #198's
engine and #281's attach-material path are the substrate.

**FB-7. create_printable outage windows.** 07-26 12:52, then 07-27 09:08 through
~12:29 intermittently: "technical snag", "the tool I use for that comes back
unavailable", "this has now happened a few times in a row", and finally Homa
advising HER to report it to the Homa team. Also 07-28 19:55. Needs a Vercel-log
investigation for those windows (deadline exhaustion? #202-class upload path?
agent-jobs claim?), plus an alerting rule: N consecutive tool-unavailable turns
for any family fires a founder-console alert. The user must never be the pager.

**FB-8. Debug rows in a real family.** 07-23 21:30-21:41 UTC: 17 materials titled
"Minimal Test Two..Seven", "Diag Cover Page", "Diag Day1..5", "Diag Creature C/E",
"Diag Four Pages" etc., child mostly Alma, status superseded, inside family
304f0003. They were invisible only because the binder filters to final; US-11/F5
would have exposed them. FIXED in this session (2026-07-28): all 17 rows verified
leaf nodes in the revises chain (nothing referenced them) and deleted from prod.
Residual: their test blobs remain orphaned on the Blob store (harmless; optional
sweep). The durable rule still needs adopting: never debug in a real family's
tenancy (the +homatest alias exists for this).

**FB-9. Reply truncation.** 07-24: the NYC itinerary was cut mid-sentence twice
("...heading back undergroun"), forcing her to ask for the missing half. Distinct
from FB-1 (input side). Likely stream/turn length limits; #203 (streaming
progress) is adjacent but the contract "never end a turn mid-sentence silently"
is its own acceptance criterion.

**FB-10. STT name collision.** In 4 of 6 calls the transcript records her saying
"Thanks, Alma" to Homa (also "Emma", "Homer", "Soma", "Palma"). Alma is a real
child in this family. Risk: journaling/memory pipelines attributing statements to
the child, and the assistant reinforcing the wrong name ("You're welcome, Alma!",
07-19 call, which reads as Homa calling the parent by the wrong name). Cheap fix:
call-line instructions note the known mishears of "Homa" and never echo a
child-name vocative back; memory extraction treats vocatives as unreliable.

**FB-11. Cross-channel amnesia recurrences.** 07-23 12:49: SMS could not find
"our call earlier today" (ended 78 minutes prior; hourly cron). 07-25 16:48: web
claimed "nothing from the NYC trip has been logged yet" while the 13:16 call had
logged 4.5 hours; the denial is worse than ignorance because it asserts absence.
Both are #278's exact acceptance case. Also feeds CG-02: had a parent hours
surface existed, she would not have needed to ask chat.

**FB-12. QC false-pass phrasing.** Rounds on 07-23/24 repeatedly claimed "it
passed the quality check" for pages she immediately showed were broken. Whether
the checker is testing the wrong artifact (screen vs print, the known scar) or
the wrong assertions, the phrasing overclaims. F6 leg 1 and 2 own the fix; the
honesty rule (claim success only against replayed complaints) can ship
independently and quickly.

## Post-council prod findings (2026-07-28, during implementation)

Three diagnoses in this document were wrong, and the corrections matter
more than the originals. All three came from prod data and the
`agent_tool_calls` record, not from reading code.

**FB-7 root cause found, and it is not a render failure (gh#345, PR #371).**
`create_printable` was never slow or crashing: it was **absent from the
model's tool list**. All six dynamic tools resolved on `turn.started`,
which eve replays on later steps through a step registry that lives in
one lambda isolate's memory. Any step served by a different isolate
dropped the tool silently. It is chronic and fleet-wide, not a
07-26/27 window: prod logs show it nightly across `create_printable`,
`generate_image`, `ask_for_details`, `ask_user_questions`,
`start_checklist`, `start_first_making`. Fixed with `step.started` plus
a CI guard. **Consequence for the rest of this study:** an unknown share
of the "where is it?" instances (FB-4) and the long revision loops (B2)
may be this bug rather than layout quality.

**FB-11 refuted as diagnosed (gh#375).** The 07-23 call was in
`call_transcripts` with its embedding populated at 16:01:20Z; the SMS
denial came at 16:50:37Z, 49 minutes later. Homa made five `recall`
attempts and the transcript was returned by none. Recall over calls is
lexical full-text search, and the 07-23 transcript is the one of her six
that never says the word "call". The semantic fallback that should have
caught it selects across all scopes and applies its limit before
filtering to the requested scope. Faster syncing (gh#278) would not have
prevented this.

**B2's scale was mis-stated (gh#348).** Fleet convergence data says
single worksheets are already good (143 chains, median 1 version, p90 3
for worksheets). The pain is packets (p90 60), flashcards (p90 11), and
games (max 20), and Carolyng authored 8 of the fleet's 9 packet chains.
The genuinely fleet-wide number is different and larger: **only 41% of
all revision chains ever reach `final`**, and the rest of the fleet
(42%) is no better than she is (36%). Draft stranding, not layout, is
the universal failure.
