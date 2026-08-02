---
description: Use when a parent asks what one useful thing to try next with a child, asks what to work on next from Progress evidence, or wants one small activity for today grounded in what Homa already knows. Not for creating a worksheet or lesson artifact; materials-studio owns that. Not for putting work on a date; planner owns scheduling.
metadata:
  homa-tools: verify_progress_next_move, persist_progress_next_move
  homa-related-skills: materials-studio, planner
---

# One verified next move

Give the parent one small thing that fits this child today. The useful result is
not a curriculum, a score explanation, or a list of options. It is one grounded
move she can understand, edit, and choose.

## Inputs and evidence order

Use the fresh Progress data in family context. For one child, read:

1. Open conflicts.
2. Current evidence items, including answer, derivation, source, and date.
Never use a sibling as evidence. Never turn age, a score, or a generic
developmental expectation into proof about this child.

`ask_next` means the next unanswered assessment question. It does not mean the
child is ready to learn that item. Never use it as an instructional target or
as evidence of readiness.

## Stop before proposing

Do not offer instructional advice when the current state cannot support it.

- An open conflict means confirm the differing answers first. Do not average
  them or choose one.
- No saved evidence means ask for one recent concrete observation.
- Evidence older than the verifier's freshness window means ask what has
  changed lately.
- Evidence whose derivation is unknown means confirm what happened before
  building advice on it.
- If the parent has not identified a child and more than one child could fit,
  ask one short child question.

The verifier re-checks all four data stops. Its clarification is the truth.

If every fresh evidenced item is `easily`, stop. Do not manufacture practice
or disguise a different skill as an extension. A future graph-ready capability
will own verified next-skill targets.

## Choose one candidate

When the state is eligible, propose exactly one candidate and call
`verify_progress_next_move` before showing it.

The candidate must include:

- One child id from the authenticated family context.
- One target item id. It must be a fresh current evidenced item.
- One to three fresh current evidence item ids that explain the fit. The
  target item id must be included.
- Use the evidence `itemId` values. Do not use storage-row ids or invent an id.
- Five, ten, or fifteen minutes.
- One concrete activity and one short reason.

For an authenticated internal `progress_next_move` task, call
`persist_progress_next_move` exactly once with the candidate or an honest stop.
That tool re-verifies the task fingerprint and saves the stable result. In an
ordinary parent conversation, call `verify_progress_next_move` and share its
read-only result instead.

### Activity quality

- Small enough to try today. Five to fifteen minutes is a ceiling, not a goal.
- Prefer talking, moving, reading together, ordinary paper, household objects,
  or going outside. Do not send her shopping.
- Judge physical and sensory safety for this child's age and the activity as a
  whole. Avoid choking-sized objects for young children, unsupervised water,
  heat, climbing, allergen-dependent food, or assumptions about mobility or
  sensory tolerance. When safe fit is unclear, stop.
- Make the observable action clear. "Read together" is vague. "Let Maya read
  one page, then ask her to point to the sentence that surprised her" is usable.
- Keep support warm. Describe what to try and what to notice, never what the
  child should already know.
- One move only. Do not append alternatives, a sequence, or a bonus challenge.
- Choose one exact ordinary-material setup. Do not hand the parent a menu of
  interchangeable objects; making that choice is Homa's work.
- The reason names the saved observation in parent language. Do not mention
  scores, months ahead, confidence percentages, or internal system terms.
- Match the target's meaning exactly. Practicing counting is counting;
  comparing groups is a different skill and needs its own verified target.
- Say “you shared” for direct evidence. Say “Homa matched” for inferred
  evidence. Never make an inference sound parent-confirmed.

The model chooses the activity. Code verifies identity, catalog membership,
fresh provenance, conflicts, and the allowed working edge. A plausible activity
with a rejected id is still rejected.

## After verification

If the tool returns a verified move, share only that activity and its short
reason. The parent decides whether to use it. Do not schedule it, save it to a
plan, create a material, purchase anything, or message anyone.

If she wants it changed, adjust it in conversation and verify the revised
candidate again. If she then explicitly asks for a printable, load
`materials-studio`. If she explicitly asks to put approved work on a date, load
`planner`, read the plan first, and follow its confirmation rules.

If the tool returns a clarification, ask that one question and stop. If it
returns no move, say the evidence is not strong enough for a useful suggestion
yet and ask for one recent example. Never repair ids from memory or call the
tool repeatedly with guesses.

## Examples

### Verified practice at the working edge

Progress says Maya read a short early reader with some help. A good candidate
targets that same verified reading skill with a ten-minute shared page: Maya
reads until she wants help, the parent supplies the word, and Maya rereads the
whole sentence. The reason points to the saved observation that she is already
reading connected text with support.

### Current strength

Progress says Finn counts twenty objects independently and all other fresh
items are also `easily`. Return no move. Comparing groups would be a different
skill, and more counting would be work invented only because the card exists.

### Safe practice for a young child

Progress says three-year-old Noor is beginning to count up to five objects.
Use five socks on the floor with an adult beside her. Let Noor move each object
into a basket while saying one number. Stop when she has counted the five
objects. Never
suggest coins, beads, buttons, loose caps, or other choking-size counters for a
young child, even when they make the counting instruction shorter.

### Exact skill, not a nearby challenge

Progress says Maya is getting there with counting up to five objects. Put five
spoons on the table and let her touch each spoon once while saying the numbers
from one to five. Stop there. Counting backward, hiding an object, comparing
groups, or asking how many remain would add a different skill that current
evidence has not verified.

### Conflict

Two adults gave different answers for the same reading skill. Do not suggest a
reading activity. Use the verifier's clarification and let the parent confirm
what fits today.

### Stale or missing provenance

The only answer is old, or Homa cannot verify how it was matched. Do not dress
it up as current knowledge. Ask for one fresh example, then return after it is
saved and visible in Progress.

## Final check

Before responding, verify:

- one child, one target, one move;
- every evidence item id came from current Progress context;
- the verifier accepted the candidate;
- the move can happen today without a purchase or hidden side effect;
- the reason is about an observation, not a verdict on the child;
- nothing was scheduled, saved, sent, or created without a separate request.
