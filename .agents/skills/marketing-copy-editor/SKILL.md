---
name: marketing-copy-editor
description: The editor gate. A second fresh-context, read-only subagent checks a draft against the Homa copy rulebook plus marketing house style, returning structured notes only, never rewrites. Runs after marketing-copy-reviewer, never before. Not for reader comprehension (marketing-copy-reviewer) and not for defining voice; it applies the canonical rulebooks.
---

# Marketing copy editor (the editor gate)

The craft pass. Runs on the post-reviewer rewrite, so comprehension problems
are already fixed before style gets polished (the order law lives in
`marketing-copy-reviewer`).

## How the orchestrator dispatches this gate

Dispatch mechanics, the delivery instruction, the order law, and the
shared laws live in `.agents/copy-gate-protocol.md`; follow it exactly.
This gate's dispatch prompt must contain, in this order, pasted verbatim:

1. The full text of `.agents/skills/homa-copy-writer/SKILL.md`.
2. The full text of `marketing/voice/house-style.md`.
3. This instruction block:

> You are a professional copy editor for Homa. The copy rulebook and marketing
> house style above are your entire standard; do not import outside taste.
> Check the draft below against
> it: voice principles, hard bans, the anti-slop banlist, format rules
> (lengths, limits, CTA count), and general craft (sentence logic, explicit
> antecedents, transitions, section order, keyword-shaped phrasing, flow,
> repetition, weak verbs, filler). Return structured notes only, each as:
> location (line or
> quote), problem, which rule it breaks (cite the house-style section), and
> severity (must-fix for rule violations, suggestion for craft). Do NOT
> rewrite lines, do NOT produce a corrected draft, do NOT contradict the
> reader gate's accepted changes on comprehension grounds.

4. The full post-reviewer draft.
5. The protocol's delivery instruction, with one addition for this gate:
   notes come back grouped must-fix then suggestion.

## What comes back, and what to do with it

Structured notes. The main agent implements every must-fix, uses judgment on
suggestions, and rewrites the draft itself. If a must-fix reveals a slop
phrase not yet on the banlist, the fix includes adding it to
`marketing/voice/house-style.md` so the scorer catches it mechanically forever
after.

## Batch mode (micro-copy)

Pillars (article, video script, email) are edited one at a time. Micro-copy
(the four captions, pin text, X post) is edited as one batch in a single
dispatch: same rulebook, notes keyed per file. One pass over the set is the
deliberate cost/quality trade recorded in spec 14 §5.

## Laws

Shared laws (read-only subagent, no family data, order law,
never-auto-publish) are in `.agents/copy-gate-protocol.md`. Specific to
this gate: it never edits `voice/house-style.md` content rules on its own;
banlist additions happen through the main agent as part of a fix.
