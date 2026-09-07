---
description: Use when a parent asks what a child should work on or try next, even if the child or subject needs clarification, saved skills are already easy, evidence is incomplete or conflicting, or earlier practice no longer fits. Also use for accepted next-step offers, declining more practice, and deciding whether to offer help after a confirmed progress save. Not for asking assessment questions, explaining a score, creating a material, scheduling work, or adding periodic reviews; progress-check-in, progress-reading, materials-studio, and planner own those jobs.
metadata:
  homa-tools: explore_child_map, verify_progress_next_move, persist_progress_next_move
  homa-related-skills: progress-check-in, materials-studio, planner
---

# One verified next move

Help the parent avoid unnecessary work. A supported stop is as useful as an
activity. In ordinary chat, follow these decisions in order:

1. **Was help requested or accepted?** A decline ends with an acknowledgement.
   A save receipt alone allows an optional offer, then end the turn.
2. **Are child and subject clear?** If either is unclear, ask that one scope
   question and end the turn. Resolve the child first: "Which child, Maya or
   Finn?" Do not guess which child "she" means or add the subject question yet.
3. **Read the canonical subject now.** Call `explore_child_map` with
   `query: saved_answers`, including when the context already shows a conflict
   or apparently easy answers. The context is a summary, not this read.
4. **Choose one endpoint from that read.** For a failed read, relay its
   parentMessage and end. A conflict needs one clarification. An incomplete
   inventory with no suitable returned target needs one recent-example or
   scope question. Stale or unknown evidence needs one update. A complete,
   fresh, known all-easy inventory goes to the verified-stop endpoint below.
5. **Only a supported target gets an activity.** Choose and verify one fresh
   Getting there or Not yet item before sharing the activity.

Once an endpoint says to end, finish the reply there. The September 5 cutting
report was harmed by supplying more work despite evidence it was unnecessary.
A clarification ends at its question, without promising that the answer will
lead to an activity; an easy answer may instead establish a supported stop.

## Enter at the right moment

An explicit request for next-step help can proceed now. Confirming a progress
save accepts that save, not an activity. Unless the parent already asked for
an activity or accepted an earlier offer, acknowledge the actual saved receipt
or ask "Want one idea to build on that?" and end the turn before reading targets
or calling the verifier. Skip the offer when she declines, is wrapping up,
or just wants a record saved. Acknowledging a log is not permission to quiz
every child or add work to the week.

A statement such as "we're moving on" is not proof of mastery. Follow the
existing evidence-capture procedure for saving observations; this skill does
not interpret a transition as an answer or claim a save without a receipt.
Periodic review timing is a separate product decision, not a reason to start
check-ins, enroll reminders, or promise a monthly review here.

## Read one child's current evidence

Resolve the child from authenticated context and the parent's request. Never
use a sibling as evidence. If more than one child could fit, ask which child.
Use the subject she named or the one already in the current discussion. If
there is no clear subject, ask one short scope question instead of scanning
every child and subject.

In ordinary parent chat, use the canonical read from step 3. Read its
`savedAnswers`: itemId, statement, answer, observedAt and derivation. The
family-context summary can omit whole subjects, including music and motor;
omitted context is not missing evidence. The catalog ladder and a comparison's
winning basis are not the complete saved-answer inventory.

Check `conflicts.total` before interpreting the saved-answer list.
The reader supplies each conflicting item and both dated source answers in
`conflicts.items`. Conflicting items are excluded from `savedAnswers`, so a complete list of easy
answers can still sit beside an unresolved conflict. When the selected subject
has a conflict, ask one useful question about the current ability and stop;
do not call that subject all-easy or empty.

Check `coverage`, `answerCounts` and `savedAnswers.omitted` before reading the
individual answers. Counts cover the whole saved inventory, not just this slice. Use a returned eligible item when one fits;
do not infer "all easy" or "nothing saved" from an incomplete list. If the
returned slice has no suitable target, say it does not establish one and ask
one useful scope or recent-example question. A failed canonical read is
unavailable, not an empty record: explain that the read could not be checked
and stop rather than falling back to remembered levels.

For a trusted internal `progress_next_move` task, its bounded task context is
already the exact child, allowed target set and eligible evidence. Use that
context and its fingerprinted persistence procedure below. Its eligible evidence
already passed the time and provenance checks; persistence rechecks them. Do not
call the chat reader or expand its target set.

## Stop before proposing

- A conflict returned by the verifier needs its one clarification first.
- No saved evidence needs one recent concrete observation.
- Evidence over 30 days old needs an update. The verifier owns the exact
  freshness boundary; a recent calculation date does not refresh an answer.
- Unknown derivation needs confirmation. A source label such as "check-in"
  does not establish that the answer was direct.
- A current parent correction that this activity is already easy is a floor.
  Do not repeat the drill because an older saved answer says Getting there.
  Use the existing capture path for a concrete current claim, re-read after
  the confirmed save, or ask one useful clarification if it is still unclear.

### Verified stop

When the complete selected-subject inventory is fresh, known and all `easily`,
call `verify_progress_next_move` with the childId and
`decision: { kind: all_easy_stop, subjectId }`. It rechecks the complete current ledger. On a verified stop,
acknowledge those saved abilities and end the reply. For example: "Both saved
cutting skills are already easy for Maya. I wouldn't add a scissors drill here."
That is the whole endpoint, including when she explicitly asked what to try next.
Do not relabel extra practice as crafts, maintenance, enrichment or an optional
idea. A rejection explains the actual limit; it is not an invitation to improvise.
The receipt establishes neither whole-subject mastery nor an unassessed extension.

`ask_next` is an assessment question, not an instructional target. A graph
`ready_next` result is not this verifier's approval for an unassessed extension.
Do not manufacture a different skill or practice already-easy work to fill a
card. Broader verified next-skill extensions need their own capability.

## Choose and verify one candidate

Choose one exact fresh saved `getting_there` or `not_yet` item. Call
`verify_progress_next_move` with the childId and `decision.kind: activity`
before showing it. The decision contains:

- That target's real itemId, never a storage-row id or an invented id.
- One to three fresh current evidence itemIds in the same subject, including
  the target itself.
- Five, ten, or fifteen minutes, one concrete activity, and one short reason.

The tool re-reads the canonical ledger. Its rejection or clarification wins
over earlier context. Ordinary chat is read-only. For a trusted internal
`progress_next_move` task, call `persist_progress_next_move` exactly once with
one candidate from its allowed set or an honest stop instead; it re-verifies
the task fingerprint and saves the stable result.

### Activity quality

- One small activity, not a sequence, alternatives, or a bonus challenge.
- Choose one ordinary setup the family can use today without shopping: talk,
  movement, reading together, ordinary paper, household objects, or outdoors.
- Judge safety for this child and activity. Avoid choking-sized objects for
  young children, unsupervised water, heat, climbing, allergen-dependent food,
  or assumptions about mobility or sensory tolerance. Stop if safe fit is unclear.
- Make the observable action clear. "Read together" is vague; reading one page
  with help on unfamiliar words is usable. Keep support warm, never a verdict.
- Match the exact target. Counting five objects is not comparing groups,
  counting backward, or deciding how many remain after hiding one.
- State only capabilities with their own saved answer. Working on curves does
  not establish mastery of straight lines; a prerequisite graph is not evidence.
- The reason names the saved observation, how it was learned, and its date.
  Direct means the parent shared the answer directly; inferred means Homa
  matched it from what was shared. Preserve this distinction in both directions.
  Say "You shared..." for direct evidence and "Homa matched..." for inferred. Never present inferred evidence as parent-confirmed. No raw quote
  is available unless an actual source read supplies it.
- Do not turn age, chart credit, or typical teaching windows into readiness.

The model judges activity fit and safety. Code verifies identity, catalog
membership, fresh provenance, conflicts and cited evidence. A plausible
activity with a rejected id remains rejected.

## After verification

Only after accepted verification, share the activity and its brief reason.
Use the returned evidence receipt in the parent-facing reason, including its
observation date and whether the parent shared the answer directly or Homa
matched it from their words. Putting provenance only in a tool input leaves
the parent unable to check the recommendation. For example: "Homa matched
curved cutting as Getting there from your September 4 correction." Do not
call that a directly confirmed answer.

Do not schedule, save to a plan, create a material, buy anything, or message
anyone. A separate request
for a printable goes to `materials-studio`; scheduling approved work goes to
`planner` and its read-first confirmation procedure.

If she changes the activity, verify the revised candidate again. If the tool
returns a clarification, ask that one question and stop. Other rejections mean
no verified activity: explain the specific limit without repairing ids from
memory or repeatedly guessing. An all-easy stop is not weak evidence.

## Examples

**Stale cutting:** the selected subject has July 7 straight-line cutting,
Getting there, with unknown derivation. It is now September 5. Do not suggest
cutting strips or curves from that record. Ask what cutting looks like now.
If a later confirmed save makes straight lines Easily and curves Getting
there, re-read and verify a curves target. Do not keep the straight-line drill.

**Current strength:** all current saved counting skills in the complete read
are Easily. More counting is not needed just because a suggestion was requested.
Comparing groups would be a different skill. Explain the supported stop.
Use the verified-stop endpoint for that complete record.

**Young child:** a recent direct answer says three-year-old Noor is Getting
there with counting five objects. One candidate uses five socks on the floor
with an adult beside her, moving each into a basket while saying one number.
Stop after the five. Coins, beads, buttons and loose caps are not a safe shortcut.

Before responding, check the endpoint: an unaccepted offer contains no
activity; a clarification or supported stop adds no practice. Only an activity
needs one child, one exact target, one move and accepted verification. Preserve
faithful evidence dates and provenance, with no unrequested effects.
