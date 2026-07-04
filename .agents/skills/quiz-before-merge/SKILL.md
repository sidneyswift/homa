---
name: quiz-before-merge
description: Generate a merge-readiness report on a diff (context, mental model, non-obvious behaviors) that ends in a quiz the user must pass before merging, turning "I skimmed the diff" into verified understanding. Use before merging any substantial or agent-written change, when the user asks "do I understand this change", "quiz me", "am I ready to merge", or wants a PR explained before approval.
---

# Quiz Before Merge

## Overview

A big diff gets skimmed, approved, and merged, and its unknowns surface later as a page. The report-plus-quiz makes understanding checkable: read the report, then prove it. The artifact refuses to let the user feel done until they actually are. Do not merge until the quiz is passed clean.

## Output shape

One self-contained HTML report on the diff, in two parts.

### Part 1 · The report

- **Header stats**: branch, files changed, lines added/removed, commit count.
- **The mental model**: one before/after flow diagram worth all the files. Show where a request or data flow went before the change and where it goes now, with the new components marked. Prefer a simple two-column layout over a fancy graph.
- **Non-obvious behaviors this introduces**: 3 or 4 cards for the parts a diff skim will not reveal. Each card has three fields:
  - **What**: the behavior, precisely ("exports render from the original upload, never the proxy the reviewer watched")
  - **Why**: the reasoning that makes it deliberate rather than accidental
  - **Where**: file and line references
- **Existing behavior this leans on**: the hidden dependencies. What the change reuses without modifying (middleware, auth, lifecycle rules), and any open ticket that could change that ground under it ("if BL-2214 changes guest sessions, export downloads change with it; nothing in this diff would flag that").

### Part 2 · The quiz

- Six questions, each a decision the user would have to make correctly during an incident or a review. Not trivia: "a worker crashes mid-render, what does the job look like for the next 10 minutes and why", not "what is the name of the new table".
- Multiple choice with plausible wrong answers drawn from the misreadings the report warns against.
- Score gate at the bottom:
  - **Pass (6/6)**: show "cleared to merge" with the standard checklist: understanding verified, CI green, migrations reviewed, squash-merge with the report summary as the commit body, post-deploy watch item, known-dependency note for the merge comment.
  - **Fail**: list the missed questions mapped back to the exact report section to re-read, and offer a reset. No partial credit path to merge.

## Quality bar

- Source everything from the actual diff: real file paths, real line numbers, real migration IDs. Read the full diff before writing, not just the summary.
- Every quiz question must trace to a report section, so a wrong answer has a place to send the reader.
- Include at least one question about what the change does NOT do (the dependency it leans on, the case it deliberately excludes). Inherited behavior is where merged surprises live.
- Keep the pass bar absolute. The point is the gate, not the score.

Source: Thariq Shihipar, "A Field Guide to Fable: Finding Your Unknowns", example 11 at thariqs.github.io/html-effectiveness/unknowns/.
