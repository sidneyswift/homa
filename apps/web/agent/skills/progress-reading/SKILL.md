---
description: Use when explaining an actual child's saved Progress reading, its months-ahead number, supporting evidence, or observation date. Not for editing or rewriting a sentence that merely mentions Progress or months ahead; that is a writing request. Not for starting or answering a check-in, choosing practice, or recording school time; progress-check-in, progress-next-move, and hours-records own those jobs.
metadata:
  homa-tools: explore_child_map
  homa-related-skills: progress-check-in, progress-next-move, hours-records
---

# Explain one Progress reading

Help a parent understand one child's saved reading. Explain the specific
reading and evidence, not a whole-child grade, national rank or sibling
comparison. Resolve the child and subject from authenticated context; ask
one short question only when either is ambiguous.

Every explanation that names supporting evidence must include how Homa
learned it, explicitly distinguishing shared directly, matched from what was
shared, or origin unknown. Include the supporting answer's date. These are
required parts of explaining the evidence, including brief replies; an answer
without them can misrepresent an inference or old observation as a fresh
demonstration. This preserves the provenance lost in the #1097 evals.

## Read the evidence

Use the canonical comparison in current Progress context. If the requested
child or subject is omitted, unavailable, or needs refreshing, call
explore_child_map with subject_map for that exact child and subject. A failed
read is unavailable, not an empty record. Offer to retry rather than estimate
from age, conversation history or compatibility answers.

Always make that subject read when asked why a new answer did not change the
number. Its savedAnswers inventory contains the exact saved answers, dates,
provenance and credited skill ages, including Not yet and lower-credit answers.
Respect its omitted count. The ladder is a bounded catalog, not that history.
The comparison's basis contains the highest credited answers supporting this
reading. Those lists serve different purposes. A saved lower-credit answer
can count without replacing the basis. No repeat save or check-in is needed.

## Explain only what answers this question

Build a short reply from the reading, one supporting skill, how and when
it was learned, and the relevant limitation. Stop there. Listing the rest of
the checklist or describing scoring machinery often adds unsupported claims.

1. **Reading.** Use the exact displayLabel. projectedAt dates the calculation,
   not the supporting observation. Today's calculation can use older evidence.
2. **Support.** Name a basis skill and preserve its answer. Getting there is
   emerging ability, not Easily. Several answers can tie for credit. An
   omittedBasisCount means the basis shown is a sample, not all observations.
3. **Provenance.** observedAt dates the supporting answer. Direct means shared
   directly; inferred means Homa matched the skill from what was shared;
   unknown means the record does not say which. A Check-in source label does
   not establish direct provenance. Inferred does not reveal the parent's
   original wording; only an actual source quote would establish that.
4. **Limit.** Choose the applicable row below. Explain that particular limit,
   rather than importing one from another example.

| Returned comparison | Meaning to explain |
|---|---|
| Positive, limitReason null | The exact approximate display and its saved support. No display cap changed this result. |
| display_cap | Keep "At least". This is a display limit, not proof that harder questions ran out or the child is below a minimum age. |
| checklist_ceiling | The saved answer reaches the top of this checklist. That limits this reading, not the child's ability. |
| No positive number, with credited evidence | Describe the supported skill; its credited reference age does not exceed the child's current age. There is no positive months-ahead number to report. |
| no_frontier | The saved answers have not received age-comparison credit. A Not yet answer is still saved evidence, not an empty checklist or a measured zero. |
| Exposure-based or unavailable | Explain that this read cannot supply an age comparison. Distinguish an unavailable read from no evidence. |

Keep machine states and field names in the reasoning, out of the reply.
Translate them into the meanings above. Do not reconstruct what an older
interface displayed or which records it used without checking that history.

Three ages have distinct meanings: ageMonths is the child's current age;
creditedAgeMonths is the scorer's credit for that skill; typicalAgeMonths is
a catalog reference. When arithmetic is needed, explain those operands.
Skill credit 58 minus child age 36 is 22, while the capped display can be
"At least 12 months ahead." The 22 is that arithmetic difference, not a known
true developmental gap. More answers can broaden the evidence without
changing the display cap or yielding a more precise number.
For example, credited age 48 minus child age 24 is 24, not the displayed 8.
If displaying 8 because of a cap, state that distinction explicitly. Prefer
the exact display and named support over unsolicited arithmetic.

Citations name milestones, standards or typical teaching windows. They are
not national standardized assessments, percentiles or proof of complete
subject mastery. Preserve actual citations; absent links remain absent.
Counts describe saved answers, not statistical confidence. One Easily or
Getting there can establish a credited comparison; more answers alone do not
promise a positive number. Open conflicts stay unresolved and uncredited.
When asked what benchmark supports the number, name the actual cited source
or sources in the basis. "A typical window" alone does not identify them.

## Check the reply against the actual record

For an old inferred answer and a newer lower-credit one: "The calculation is
from today. The 10-month reading uses the catching answer from September 6
last year, which Homa matched from what you shared. Today's galloping answer
is saved too; it earns less credit, so catching still supports the number."
Use actual values and dates. The inference does not tell us what words the
parent did or did not use.

For a nonpositive comparison: "There isn't a positive months-ahead number
here. You shared today that she catches a big ball most of the time, marked
easily. The reference age credited for that skill is earlier than her current
age. This describes that saved skill, not her overall development."
Use actual provenance. There is no need to describe other checklist entries.
If the parent asks about them, use each returned saved status individually;
a non-winning answer is not necessarily unanswered.

"Why is this 16 months ahead?" asks for explanation, not a new check-in.
This read workflow never saves evidence or starts practice. A separate request
for questions belongs to progress-check-in; practice belongs to
progress-next-move; a new observation follows the existing capture boundary.
