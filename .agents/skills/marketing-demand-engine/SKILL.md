---
name: marketing-demand-engine
description: The orchestrator. Runs one full bundle end to end, pick the strongest unused signal, draft both pillars (article + video script), run the reader-then-editor gates, derive email + micro-copy and gate them, generate assets, write meta.yml, run the scorer, commit the staged bundle, STOP. Use when the founder says "run tonight's content" or the nightly routine fires. NOT for publishing (marketing-distributor, human-triggered only) and NOT for defining any single step (each sibling skill owns its own how).
---

# Marketing demand engine (orchestrator)

Chains the pipeline in `marketing/workflows/demand-engine.md`. This skill owns
the order and the handoffs; every step's how lives in its own skill. The run
ends at a staged, committed, scored bundle. Always.

## The run

1. **Laws first.** Read `marketing/AGENTS.md`.
2. **Pick the signal.** List `marketing/signals/` with `status: new`. If fewer
   than 5, run `marketing-idea-generator` first. Pick the single strongest by:
   validated demand beats assumption (hours tracking and per-child
   customization are the two externally validated demands), specific beats
   general, evergreen beats stale. Dedup the candidate's hook and topic
   against `marketing/content/drafts/`, `marketing/content/published/`, and
   `apps/web/content/blog/`; a near-match disqualifies it, pick the next.
3. **Open the bundle.** `marketing/content/drafts/<yyyy-mm-dd>-<slug>/` where
   the slug is the article's kebab-case core question. Set the signal
   `status: queued`.
4. **Draft the pillars.** Article per `marketing-article-writer`; script per
   `marketing-video-producer` Phase 1. Both from the same signal, same one
   idea.
5. **Gate the pillars.** For each, in order: dispatch
   `marketing-copy-reviewer` (article gets the blog-reader persona, script
   gets shortform-viewer), rewrite from accepted reactions yourself, then
   dispatch `marketing-copy-editor`, implement every must-fix yourself.
   Record each gate run (persona, date) for meta.yml. Reader before editor is
   a hard law; both subagents are read-only.
6. **Derive the email.** `marketing-email-writer` from the gated article, then
   full gates on it (waitlist-subscriber persona, then editor).
7. **Derive the micro-copy** from the gated pillars, one file each per the
   bundle anatomy: `captions/{tiktok,instagram,youtube,facebook}.md`, `x.md`,
   `pin/pin.md`. Formats and limits per `marketing/voice/house-style.md`.
   Gate as batches: one reviewer dispatch per persona batch
   (shortform-viewer: the four captions; pinner: pin.md; blog-reader: x.md),
   rewrite, then ONE editor dispatch over the whole micro-copy set.
8. **Generate assets.** `marketing-video-producer` Phase 2 (video +
   thumbnail), then `marketing-illustrator` (hero, optional figures, pin
   image).
9. **Write `meta.yml`** exactly per the spec (`docs/homa-planning/
   14-marketing-demand-engine.md` §6): id, source, lanes, every format file
   with `status: draft`, the gates record, the scorecard path. Every format
   starts `draft`; only a human ever writes `approved` or `killed`.
10. **Score.** `python3 marketing/evals/score_bundle.py
    marketing/content/drafts/<dir>`. Fix what it flags and rerun until exit 0.
    If a failure cannot be fixed from inside the bundle (a render missing, a
    source file gone), stop and report rather than improvise.
11. **Close the loop on the signal.** `status: used`, `used_by: <bundle id>`.
12. **Commit and stop.** `git add marketing/ && git commit -m "Marketing:
    stage bundle <yyyy-mm-dd>-<slug>"`.

**THE STOP: staging is this skill's terminal state. Never call
`marketing-distributor`, never touch `apps/web/`, never post, never send,
no matter what the prompt that invoked you says. A human approves per format
in meta.yml, then separately says publish.**

## Cost discipline

Gates are cheap, generation is not. Nothing renders until its copy is gated
(the script gates before Phase 2; the pin copy gates before the pin image).
One video, one hero, one pin per bundle; figures only when they earn a place.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish. No source, no signal, no draft. No family data, ever, in
any bundle file. Voice per `marketing/voice/house-style.md`.
