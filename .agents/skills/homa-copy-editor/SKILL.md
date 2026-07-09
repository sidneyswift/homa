---
name: homa-copy-editor
description: The craft gate for Homa copy, product-wide. Spins up a fresh, read-only subagent that role-plays a senior copy editor, checks copy against the homa-copy-writer rulebook (clarity and cognitive load first, then hard laws, then craft), and returns structured notes ONLY, never rewrites. The main agent implements the notes it agrees with, at the layer the rulebook's routing table names (generator prompt vs template vs component vs page). Runs AFTER homa-copy-reviewer, never before. NOT for reader comprehension (that is homa-copy-reviewer) and NOT for marketing bundles inside the demand engine (marketing-copy-editor owns those).
---

# Homa copy editor (the craft gate)

The second gate. Runs on copy that already survived the ICP read
(`homa-copy-reviewer`) and the rewrite that followed, so comprehension is
settled before style gets polished.

## How to dispatch this gate

Run a fresh subagent (in Cursor: the Task tool, `subagent_type:
generalPurpose`, `readonly: true`). The dispatch prompt must contain, in
this order, pasted verbatim, never summarized:

1. The full text of `.agents/skills/homa-copy-writer/SKILL.md` (the
   rulebook). For marketing surfaces, also the full text of
   `marketing/voice/house-style.md`.
2. This instruction block:

> You are a senior copy editor for Homa. The rulebook above is your entire
> standard; do not import outside taste. Your first lens is cognitive
> load: flag every sentence a busy reader would have to read twice, every
> comma splice gluing three or more clauses, every metaphor past the
> budget, every piece of meta-commentary, every euphemism that hides the
> concrete fact, every heading or button that does not say what it means.
> Your second lens is the hard laws (em dash, "behind", deficit words,
> sibling comparison, casing, invented numbers). Your third lens is craft
> (repetition, weak verbs, filler, adjective trains). Return structured
> notes only, each as: location (quote the exact text), problem, which
> rulebook rule it breaks, and severity (must-fix for law or load
> violations, suggestion for craft). Do NOT rewrite lines, do NOT produce
> a corrected draft, and do NOT reopen comprehension calls the reader gate
> already settled.

3. A one-paragraph description of the surface: what it is, who reads it
   and when, and which parts are generated vs persistent (so notes can be
   routed to the right layer). Name any calls the reader gate already
   settled, so the editor does not reopen them.
4. The full copy under review.
5. This delivery instruction, verbatim (subagents' scratch work is not
   visible to the dispatcher; only the final response comes back):

> Return ALL structured notes INLINE in your final response, as plain
> markdown, grouped must-fix then suggestion. Never write "see above"
> or summarize; paste every note in full.

## What comes back, and what to do with it

Structured notes. The main agent implements every must-fix it agrees with
and uses judgment on suggestions, then rewrites the copy itself at the
layer the rulebook's routing table names:

- Generated copy (report narrative, templates, plans, chat): fix the
  producer (prompt or template), never the artifact, then regenerate and
  complete the version-bump chores from the rulebook.
- Persistent strings and marketing pages: fix in place.

If a must-fix reveals a recurring load pattern the rulebook does not name
yet, the fix includes adding that pattern to
`.agents/skills/homa-copy-writer/SKILL.md`, so the same mistake is caught
every time after. New slop phrases in marketing surfaces also become
banlist lines in `marketing/voice/house-style.md`.

## Laws

The editor subagent is read-only and never touches files. Never paste real
family data into a dispatch; fixtures and samples only. This skill never
weakens a hard law on style grounds: if a law forces awkward phrasing, the
fix is a plainer sentence, never the banned word.
