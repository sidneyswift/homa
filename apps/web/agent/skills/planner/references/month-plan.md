# A brand-new month, preview first

Use this workflow when a parent asks for a new month, especially when she
names a real-life constraint such as co-op Thursdays, lighter Fridays,
appointments, a trip, work hours, or materials she wants to reuse.

This is planning judgment. You decide how to balance children, subjects,
energy, progress, commitments, and what the family already owns. The tools
verify identities, dates, conflicts, revision lineage, and the final write.

## Read before drafting

1. Read the authenticated family context already present this turn. Use
   every child, their recent progress, interests, what works, homeschool
   style, and named curriculum. Never ask for a fact that is already there.
2. Call `open_planner` once for each child. Read all four weeks, check-offs,
   and real scheduled dates. The saved month is evidence, not a template to
   overwrite blindly.
3. Call `list_family_events` for the exact month. Co-op, appointments,
   trips, and family days are fixed points. School bends around them.
4. Call `find_materials` for each child with `status:"final"`. Reuse only a
   real matching material id. A material that almost fits is not a reuse.
5. Ask only for a missing choice that would genuinely change the month. Use
   `ask_user_questions` for one to three short choices. If a reasonable
   lighter default is safe, put it under unresolved choices in the preview
   instead of blocking the whole draft.

## Returning from the Binder

When the parent sends the prepared Binder message, call `preview_month_plan`
with `action:"resume"` and no other fields. The selected draft is carried in
request context, not parent-visible copy or model input. The tool rechecks that
it belongs to this authenticated family, binds it to the current session, and
opens the latest saved revision. Do not ask her to repeat the month, rebuild it
from transcript memory, or call `open_planner` before showing the recovered
preview. After it is visible, continue with the normal revise, restore,
approve, or abandon workflow below.

## Drafting rules

- Build four dated weeks for every child in the family. Keep each week
  readable at a glance, usually two to four activities per child.
- Write focus labels the way a parent talks about the week, such as "finish
  the pond chapter" or "practice the nine-times table." Do not use
  assessment-like labels such as "reading stamina" or "numeracy fluency."
- Put activities on real dates when the family gave enough information.
  Leave an activity unscheduled when choosing a date would be guesswork.
- Commitments stay fixed. Do not move, shorten, or rename them to make the
  school plan fit.
- A lighter Friday is visibly lighter, not the same load with gentler words.
- Reuse a final material by its exact id and name the fit in the activity.
  Do not create a new material during month planning.
- When judgment is possible, each unresolved choice includes your plain
  recommendation and one short reason. Do not hand the parent a neutral list
  that makes her redo your planning work.
- Preserve work already checked off when revising an in-progress month.
- No deficit framing, sibling comparisons, or verdicts. A lighter week is a
  real plan, not a failure.

## Show, revise, approve

1. Call `preview_month_plan` with `action:"create"` and the complete proposed
   month. This opens the native visual preview. Nothing is on the Planner yet.
2. Read the returned conflicts, unscheduled items, and unresolved choices.
   If a conflict is intentional, say why in one sentence. If it is not, fix
   it before asking for approval. Conflicts and unscheduled activities may
   remain when the parent knowingly accepts them. Unresolved choices may not.
3. Say: "I drafted the month. It is saved in your Binder, but nothing is on the
   Planner yet. Want to use this, or change anything?" Then stop and keep
   listening.
4. A requested change such as "move science earlier" or "make Friday
   lighter" is `action:"revise"` with the latest draft token and the whole
   updated plan. Change the smallest possible part.
5. "Undo that change" is `action:"restore"` to the revision immediately
   before the unwanted change. Never recreate an older plan from memory.
6. Call `approve_month_plan` only after the parent clearly approves the
   visible revision and its unresolved choices are empty. "I like it," "yes,
   use this," and the visible Approve action count. Silence, "looks
   interesting," or your own opinion do not. If a choice remains, resolve it
   in a revised preview first.
7. After approval say: "Your month plan is saved on the Planner." Do not narrate the
   whole month again. The screen already shows it.

## Honest stops

- If the preview says a saved month changed while it was open, read the
  Planner again and build a fresh preview. Never force the stale version.
- If a child or reused material no longer belongs to the family, drop the
  proposal and ask one short question if needed. Never substitute another.
- If she leaves or says no, call `preview_month_plan` with
  `action:"abandon"`. The Binder draft is archived and the Planner stays
  unchanged, so do not offer an undo.
- If more than three unresolved choices remain, the month is not ready.
  Ask the highest-impact question instead of presenting a wall of maybes.
