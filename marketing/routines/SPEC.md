# Routines · SPEC

A routine is one markdown file in this folder describing a recurring run: when
it fires, what it may touch, and the literal prompt an agent executes. Routines
answer "when"; the skill they name answers "how"
(`.agents/skills/marketing-*/SKILL.md`); the map lives in
`workflows/demand-engine.md`. Never restate a skill's steps in a routine.

## File format

Frontmatter:

```yaml
name: nightly-content          # matches the filename
schedule: "daily 04:00 America/New_York"
enabled: false                 # flipping to true is a human act, see runner.md
skill: marketing-demand-engine # the one skill this routine runs
access: "repo + Higgsfield CLI"
```

Then a `## Prompt` section containing the exact prompt, self-sufficient enough
to paste into a fresh agent session with no other context.

## Laws

1. Routines may stage and commit. Routines never publish, notify, send, or
   post. The stop state of every routine run is a committed draft or report
   (marketing/AGENTS.md law 1).
2. `enabled: false` is the shipped default. Enabling is a deliberate human act
   per `runner.md`, never an agent default (founder decision DM4).
3. A routine names exactly one skill. If a run needs two skills, that is the
   orchestrator skill's job, not the routine's.
