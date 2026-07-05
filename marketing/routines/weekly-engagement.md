---
name: weekly-engagement
schedule: "Mondays 07:00 America/New_York"
enabled: false
skill: marketing-engagement-loop
access: "Postiz CLI (read/analytics) + Supabase MCP (aggregate counts only)"
---

# Routine · weekly engagement

Pulls last week's performance into a report and new engagement signals.
Disabled by default (DM4): today this prompt runs when the founder says "run
the engagement loop" in chat. Enable per `runner.md` only on the founder's
explicit instruction.

## Prompt

Read `marketing/AGENTS.md` and follow its laws. Then run the
`marketing-engagement-loop` skill exactly as written: gather Postiz analytics
for every published bundle with social URLs in its `distribution.md`, gather
waitlist signup deltas as aggregate counts via the Supabase MCP, write
`marketing/reports/<yyyy-mm-dd>-engagement.md`, file one `type: engagement`
signal per real finding, commit with message
`Marketing: engagement report <yyyy-mm-dd>`, and stop.

Hard rules, restated from the laws: aggregates only, no individual parent or
child data anywhere, publish and send nothing. If no bundle has published
social posts yet, still produce the report using waitlist deltas alone and say
plainly that social analytics had nothing to read.
