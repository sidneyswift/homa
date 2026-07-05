---
name: marketing-engagement-loop
description: The weekly feedback pass. Pulls Postiz analytics for published posts and waitlist signup deltas (aggregate counts via Supabase MCP), writes marketing/reports/<date>-engagement.md, and files type-engagement signals for what actually resonated. Use when the founder says "run the engagement loop" or the weekly routine fires. Aggregates only, never individual-level data. NOT for drafting content from those signals (marketing-demand-engine) and NOT for publishing anything (marketing-distributor).
---

# Marketing engagement loop

Closes the flywheel: what the audience did last week becomes signal for what
gets made next week. It reads the world; it never posts into it.

## Procedure

1. Read `marketing/AGENTS.md` if not already in context.
2. **Social analytics.** For each bundle in `marketing/content/published/`
   whose `distribution.md` has social URLs: per the `postiz` skill,
   `postiz analytics:post <post-id> -d 7` (and `analytics:platform
   <integration-id> -d 7` once per channel). If a post returns
   `{"missing": true}`, resolve per the postiz skill (`posts:missing`,
   `posts:connect`) before reading analytics. If nothing has published social
   posts yet, say so plainly in the report and continue.
3. **Waitlist deltas.** Via the Supabase MCP (scoped to the Homa org), read
   aggregate counts only: signups this week vs last, split by source/UTM if
   the columns exist. Never select emails, names, or any row-level data for
   this report.
4. **Write the report** to `marketing/reports/<yyyy-mm-dd>-engagement.md`
   (create the folder on first run): per-channel numbers with week-over-week
   movement, top and bottom performing post with a one-line honest read on
   why, waitlist delta, and "what this suggests we make more of / less of".
   Numbers only from tools; if a number is unavailable, write "no data yet",
   never estimate.
5. **File signals.** For each real finding (a hook that overperformed, a topic
   that drove saves, a channel that outconverted), one signal file per
   `marketing-signal-extraction`'s schema with `type: engagement` and
   `source.ref` pointing at this report. Real findings only; a flat week
   files zero signals.
6. Commit: `Marketing: engagement report <yyyy-mm-dd>`.

## Laws (marketing/AGENTS.md, restated)

Aggregates only, no individual parent or child data anywhere, in reports or
signals. Never publish or send anything. No source, no signal (the report is
the source for engagement signals). Voice per
`marketing/voice/house-style.md`.
