---
name: homa-make-weekly-plan
description: Turn story-coach's scoring + proposed interventions into a follow-able Mon–Fri weekly homeschool plan PDF for the parent — the delivery vehicle that was missing. Reads a child's children/<child>.json (current levels + active interventions) and the parent's real weekly rhythm, weaves in time-sensitive opportunities and the Spanish communicative layer, and emits a phone-readable plan. Builds one plan per child (pass --child, or iterate children/*.json to build for all). Use weekly (Sunday-night cron candidate), when the parent asks "what should we do this week", or after a story-coach rescore surfaces new interventions.
---

# Homa Make Weekly Plan

> **Read `content/learners/<child>/what-works.md` FIRST.** It's the personalization model — the child's interests/hooks (Paw Patrol, frogs), how he learns (hands-on, character-carried, immersive; few worksheets), and what's landed. Let it shape this output: pick the hook, the modality, and the framing the child actually engages with — not the obvious default. A generic suggestion that ignores it is the exact friction the parent flagged (transcript 2026-06-28).

`homa-track-story-coach` *scores* the child and *proposes interventions* — but until this skill, those
interventions sat in the child's `children/<child>.json` as `proposed`, unconsumed, with **no vehicle to reach the parent**
(grounded: 2026-06-28 reflect found all 15 active interventions stuck at `status: proposed`, and two
fresh ones — Connect-Name-Prompt 06-25, tadpole-modeling 06-26 — piling up unread). This skill closes
that loop: it turns the scored profile into a *do-this-this-week* plan the parent can actually follow on her
phone.

## What it does

`python3 scripts/build-weekly-plan.py [--child NAME] [--week YYYY-MM-DD] [--out path.pdf]`

Builds one plan per child. Pass `--child NAME` to build for a specific child (resolves to
`children/<name>.json`); if omitted and exactly one `children/*.json` exists, it uses that one; to build
for everyone, iterate `children/*.json` and run once per child.

- Reads the child's `children/<child>.json` (that child's source of truth; shape reference:
  `children/_schema.json`): current level per domain + the `interventions_active` list.
- **Picks 5 high-leverage nudges**: newest proposed interventions first, biased toward **at_age growth
  edges** over domains where the child is already months ahead (a weekly nudge should push the edge, not
  celebrate the lead). De-dups by domain/subdomain so one week isn't all one area.
- Maps them onto the parent's **real rhythm** (USER.md): Mon open · Tue Spanish (tutor PM) · Wed Art ·
  Thu Pool · Fri Gymnastics; school 9–11am Tue–Fri. One focus nudge per day, rotating.
- Adds the **Spanish communicative layer** (phrases > flash cards — the child's #1 Spanish gap is
  connected speech, 2026-06-24 intervention) and **time-sensitive out-&-about opportunities** pulled
  from the night's research (currently DCPL Discover Summer, Kenilworth July lotus/frogs, USBG Butterfly
  Garden — refreshed by reflect).
- Emits a phone-friendly single-column PDF to `content/curriculum/weekly-plans/<week-start>-<child>.pdf`
  (child in the filename so per-child plans for the same week don't collide).

Default week = the upcoming Monday.

## Keeping it grounded (refresh, don't drift)

The plan is only useful if it reflects *now*. Two small editable blocks at the top of
`scripts/build-weekly-plan.py` carry the time-sensitive layer:
- `OPPORTUNITIES` — the out-&-about list (cite from `research-journal.md`; keep ≤3, drop stale).
- `SPANISH_LAYER` — the current dominant Spanish lever.

`homa-system-reflect` refreshes these when research surfaces something fresher. The intervention
picks auto-refresh from the profile, so as story-coach rescores, the plan follows.

## When to (not) build a plan
- **Do** run it weekly (Sunday-night candidate cron) and on "what's the plan this week?"
- **Don't** treat it as a rigid checklist — the footer tells the parent it's a *menu*. She picks what fits.
- **Don't** edit homeschool content/facts here — this skill *reads* the profile, never writes it.
  New interventions come from story-coach; opportunities from research. This is a renderer.

## Toolchain note
reportlab (not weasyprint — its native libs don't load in this Python env; reportlab is the workspace's
proven path: art-labels, chompsaw-patterns, syllabus PDF). Fonts: Quicksand/FredokaOne from `fonts/`,
falls back to Helvetica. **No emoji in section headers** — the bundled fonts have no emoji glyphs and
render them as tofu squares (learned 2026-06-28 on first build).

## Verified
2026-06-28 — built end-to-end from a real child's `children/<child>.json` (15 interventions, 15 domains) for
week 2026-06-29: clean 1–2pp PDF, focus table + day-by-day + Spanish layer + opportunities all render,
accents intact, no tofu glyphs. Shipped by reflect (Lens B), roadmap #3→shipped.

Added 2026-06-28 by `homa-system-reflect`. Citation: all story-coach interventions unconsumed for want
of a delivery vehicle (reflect nightly pass, 2026-06-28).
