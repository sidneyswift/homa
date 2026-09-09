---
description: Use when a parent asks for a full lesson, a complete lesson on one skill, a lesson with teaching and practice and a check, "teach this and give her practice and a test", or a lesson packet she can run start to finish without you. Not for one single worksheet, page, or activity (materials-studio owns that); not for a themed multi-topic bundle (unit-study-packet, a materials-studio format, owns that); not for a multi-week curriculum or program (curriculum-studio owns that); not for scheduling an existing lesson or curriculum (planner owns placement).
metadata:
  homa-related-skills: materials-studio
---

# The lesson studio

A full lesson is bigger than a worksheet: one skill taught, practiced,
checked, and handed back with a closed answer key, in one packet. You
own the judgment of what belongs in that packet and in what order;
materials-studio owns how each page actually gets designed and built.

## Is this even a job?

- One page, no teaching or check attached: that request is a single
  materials-studio format, not this skill.
- Several activities across one theme, no single skill driving them: that
  is unit-study-packet, a materials-studio format.
- Weeks or a whole program: that is curriculum-studio's job. This skill
  never spans more than one skill target or more than one sitting.
- "A full lesson", "teach and practice and test her on X", "a lesson she
  can run herself": build it here.

## Before building: use the child's evidence (binding)

Materials-studio's evidence hierarchy applies here unchanged. Read its
"Before designing: use the child's evidence" section before you choose
the target skill: what the parent said in this conversation outranks the
child's map snapshot, which outranks a saved "what works" memory, which
outranks anything else. No evidence for the target skill means one short
calibrating question before you build anything, never a quiz. The same
request for two kids gets two separate difficulty decisions.

## Choose the subject and any named approach

Same rule as materials-studio: read the subject reference file that
matches the lesson, and the approach file when the family follows a
named one (Direct Instruction, Charlotte Mason, Montessori, Singapore
Math, and the others materials-studio already lists), from
materials-studio's own `references/subjects/` and `references/approaches/`.
A lesson for a family that follows a named approach should teach and
frame the concept the way that approach does; the page sequence itself
stays the same.

This skill does not yet reproduce a specific named curriculum's own
exact page-by-page format (for example DISTAR's arrow-and-ball word
reading notation). That needs its own recipes, built one at a time as a
family's real request calls for them. Build the full-lesson-packet
format below for every request today, shaped by the family's approach
and subject, not by a curriculum's specific page layout.

## Build the lesson

1. Decide the one target skill and confirm you have real evidence for it
   (above). A lesson never targets two unrelated skills to look more
   complete.
2. Load `materials-studio`. Use its subject rules, creation-path guide,
   metadata discipline, page shell, and visual quality standards for
   every page in the packet.
3. Read `read_file /workspace/skills/lesson-studio/references/recipes/full-lesson-packet.md`
   before building. It is the binding page sequence, design patterns, and
   worked geometry for this format.
4. Decide the page count: 4 pages (teach, practice, check, answer key) by
   default; 5 with a parent guide added for a first-time skill or a
   family that follows a named approach.
5. Draft every practice and check item before writing any page's HTML.
   Every item is complete and concrete: exact numbers, words, or objects,
   never a placeholder the parent must invent, and every numeric bound
   the skill names is respected in every item.
6. Call `create_printable` once with `pages` in packet order,
   `recipe: "full-lesson-packet"`, and `pageRoles` matching exactly:
   `child` for every teach/practice/check page, `answer_key` last (or
   second-to-last with a parent guide), `parent_guide` last when included.
7. Read the returned review. Revise a failed page through `revisesId`,
   keeping the target skill and the passing pages unchanged. Make at most
   two revisions; stop honestly if the last review still fails.
8. Reactions, printing, copies, and finalizing (`mark_material_final`)
   follow materials-studio's own approval flow unchanged; this skill only
   owns the packet's shape and content, not what happens to it afterward.

## Format

| Format | Reach for it when the lesson must... | Recipe file |
| --- | --- | --- |
| Full lesson packet | teach one skill, practice it, check it, and hand back a closed answer key, in one PDF | full-lesson-packet |

## Guardrails (binding)

- Never claim a lesson will improve, raise, increase, boost, or
  guarantee a score. Teaching and practicing a skill is useful on its
  own; it is never a score promise.
- The check page is never a diagnosis, assessment, screening, or grade
  placement in a child's eyes. Warm framing only: "Quick check" or the
  skill's own name.
- Homa does not machine-score speech, handwriting, or a photographed
  page. The parent applies the closed answer key herself.
- No score, percentile, grade level, reading age, or sibling comparison
  anywhere a child can see it. The answer key states exact answers, not
  a verdict.
- Stop the check immediately if the child asks to stop or looks
  distressed. A stopped check is not a result, and the packet's practice
  page already gave real value regardless of how the check went.
- A full lesson is a real, deliberate request. Do not reach for this
  skill's bigger packet when the parent asked for one plain worksheet;
  that overserves a small ask and costs more of her time to review.
