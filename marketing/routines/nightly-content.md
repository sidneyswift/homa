---
name: nightly-content
schedule: "daily 04:00 America/New_York"
enabled: false
skill: marketing-demand-engine
access: "repo + Higgsfield CLI"
---

# Routine · nightly content

Stages one content bundle per run. Disabled by default (DM4, manual-first):
today this prompt runs when the founder says "run tonight's content" in chat.
Enable per `runner.md` only on the founder's explicit instruction.

## Prompt

Read `marketing/AGENTS.md` and follow its laws. Then run the
`marketing-demand-engine` skill exactly as written: pick the single strongest
unused signal from `marketing/signals/`, produce one full bundle in
`marketing/content/drafts/`, run the gates and the scorer as the skill
specifies, commit the staged bundle with message
`Marketing: stage bundle <date>-<slug>`, and stop.

Hard stop conditions, restated from the laws: do not publish anything, do not
send anything, do not post anything, do not touch `apps/web/`, do not call
`marketing-distributor`. If fewer than 5 signals have `status: new`, run
`marketing-idea-generator` first. If the scorer or an asset step fails and the
failure cannot be repaired within the bundle, stop and report the exact
blocker. Do not commit an incomplete `WIP` bundle or mark it staged.
