# Copy gate dispatch protocol

The shared mechanics for the four copy gates: `homa-copy-reviewer`,
`homa-copy-editor`, `marketing-copy-reviewer`, `marketing-copy-editor`.
Each gate's SKILL.md names only what is specific to it (its persona or
rulebook source, its instruction block, and how to route what comes back).
This file owns everything common. If a gate's SKILL.md and this file ever
disagree on shared mechanics, this file wins; fix the skill.

## Dispatch

Use the current environment's delegation mechanism to run a fresh-context,
read-only subagent. Give it only the material the gate names: no prior
drafting conversation and no file-editing task. If the environment cannot
enforce a read-only mode, state the restriction in the dispatch and keep
all file edits with the dispatching agent.

Everything the gate marks as verbatim (personas, rulebooks, instruction
blocks, the draft itself) is pasted in full, never summarized, never
linked, in the order the gate lists.

## Delivery instruction (verbatim, last item in every dispatch)

Subagents' scratch work is not visible to the dispatcher; only the final
response comes back. Every dispatch therefore ends with:

> Return your complete output INLINE in your final response, as plain
> markdown. Never write "see above" or summarize; paste the full text.

## The order law

The reader gate always runs before the editor gate, on every surface and
format, no exceptions. An editor pass first can polish jargon into
something stylish without ever asking whether the reader understands or
cares; craft-before-comprehension hides the comprehension problem.

Reader gates get exactly one read per dispatch: a second read biases the
reactions.

## Laws

- Gate subagents are read-only and never touch files. The dispatching
  agent decides which notes to accept and rewrites the copy itself, at the
  layer the relevant rulebook's routing table names; judgment and voice
  stay in one hand.
- Never paste real family data into a dispatch; fixtures and public
  samples only.
- Never auto-publish (marketing/AGENTS.md); gates inform a human-shipped
  change, they never ship one.
