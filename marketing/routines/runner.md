# Runner · how routines execute

Two modes. Mode A is today's mode (DM4, manual-first). Mode B exists so that
flipping to unattended runs later is a one-line human action, not a build
project. Publishing stays manual in both modes, forever (law 1).

## Mode A · manual (current)

The founder says the trigger phrase in a chat session; the agent runs the
routine's `## Prompt` verbatim.

| Trigger phrase | Routine |
|---|---|
| "run tonight's content" | `nightly-content.md` |
| "run the engagement loop" | `weekly-engagement.md` |

## Mode B · scheduled execution (not installed)

Blocked as of 2026-07-11. No Homa marketing launchd job is installed, and the
previous example depended on a `cursor-agent` command that is absent. The local
Codex executable's unattended invocation, authentication, permission, logging,
and failure contract have not been approved or verified.

Do not create or load a scheduler from this file. Before Mode B can be enabled,
the founder must explicitly flip DM4 and approve a reviewed scheduler change
that records the exact executable and flags, least-privilege environment,
working directory, log handling, failure notification, overlap prevention, and
an end-to-end dry run. Update the routine frontmatter and installed scheduler in
the same change so their states cannot drift.
