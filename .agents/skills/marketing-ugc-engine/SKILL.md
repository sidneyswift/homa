---
name: marketing-ugc-engine
description: |
  Create, manage, measure, and grow UGC (user-generated content) creator campaigns
  for Homa. Covers the full lifecycle: recruiting creators, writing briefs, onboarding,
  compensation, content formats, daily QA, scaling via tiering, and weekly iteration.
  Use when the founder says "run a UGC campaign", "find creators", "write a creator brief",
  "onboard a creator", "score creator content", "tier our creators", "weekly creator review",
  or any task involving influencer/creator marketing operations. NOT for organic founder-led
  content (marketing-demand-engine) and NOT for paid ads.
---

# UGC creator campaign engine

Operational system for running UGC creator campaigns at scale. Based on
proven playbooks (590+ creators, 22K+ videos, 2B+ organic views across
62 campaigns, zero ad spend). Adapted for Homa's voice, privacy laws, and
product constraints.

## Homa-specific constraints (non-negotiable)

1. **Child privacy is absolute.** No child's face, name, voice, or
   identifiable detail in any creator content. Proof is artifacts (worksheets,
   screens, plans), never children. This overrides every format suggestion.
2. **Voice laws apply.** All briefs, feedback, and creator-facing copy follow
   `marketing/voice/house-style.md`. No em dash. Reassure before inform.
3. **Never auto-publish.** Creator content stages in
   `marketing/campaigns/<campaign>/content/` for human approval. Same law as
   the demand engine.
4. **Family data banned.** Creator content never references real families by
   name. Anonymize to roles.
5. **Don't lead with AI.** Briefs frame Homa as "finding the right level":
   AI is the engine, not the pitch.

## Directory structure

```
marketing/
├── creators/              # Creator roster and shortlists
│   ├── roster.md          # Master roster (all active creators)
│   └── *.md               # Platform/niche shortlists
├── campaigns/
│   └── <yyyy-mm-slug>/
│       ├── brief.md       # The one-page brief
│       ├── playbook.md    # Campaign-specific playbook
│       ├── roster.md      # Campaign creator assignments + tiers
│       ├── content/       # Staged content for approval
│       ├── scores/        # Weekly QA scorecards
│       └── retro/         # Friday iteration reports
```

## Phases

### Phase 1: Campaign setup

1. Read `marketing/AGENTS.md` (the laws).
2. Read `references/briefs.md` for the brief template and golden rules.
3. Create campaign directory: `marketing/campaigns/<yyyy-mm-slug>/`.
4. Write `brief.md`: exactly 5 components, one page max. See
   `references/briefs.md` for the template and anti-patterns.
5. Write `playbook.md`: campaign objective, timeline, creator count target,
   budget, format slots, KPI targets.

### Phase 2: Recruiting

1. Read `references/recruiting.md` for sourcing channels and vetting.
2. Apply the 4-check vetting filter (portfolio → engagement → comms → product
   understanding). Fail one = skip.
3. Add vetted creators to `marketing/creators/roster.md` and the campaign
   `roster.md`.

### Phase 3: Onboarding

1. Read `references/onboarding.md` for the 20-minute call structure and
   onboarding pack.
2. Every creator gets the call. No exceptions.
3. Account warm-up: 3-5 niche videos before any Homa mention.
4. Register in master roster with: name, handle, platform, country, rate,
   start date, tier (all start Tier B).

### Phase 4: Content production

1. Read `references/formats.md` for proven content types and the 15-second
   formula.
2. Enforce Homa constraints: no child faces, confession > demo, proof is
   artifacts.
3. Apply the 0.5-second rule: first frame must stop the scroll (on-screen
   text, movement, direct question, surprising stat).

### Phase 5: Daily QA

1. Read `references/qa-scoring.md` for the draft scoring rubric.
2. Score every draft on 5 dimensions (1-5 each): hook strength, clarity,
   brand alignment, engagement style, conversion potential.
3. Any score ≤ 2 = send back with ONE specific note. One round, one note.
4. Use standardized feedback language (see `references/qa-scoring.md`).

### Phase 6: Scaling and iteration

1. Read `references/scaling.md` for tiering criteria and the weekly loop.
2. Tier creators monthly: S (elite) → A (top) → B (reliable) → C (phase out).
3. Run the Friday iteration loop: top 5 / bottom 5 → pattern ID → format
   update → share findings.

## Tools used

- `marketing/creators/roster.md`: master creator roster
- `marketing/campaigns/`: campaign directories
- `marketing/voice/house-style.md`: voice authority
- `marketing/AGENTS.md`: pipeline laws

## Anti-patterns

- Writing briefs longer than one page (kills authentic content at scale)
- Scripting creator content word-for-word (guide, don't script)
- Skipping the 20-minute call ("at 590 creators we still do every call")
- Multiple rounds of revision (one round, one note, or it bottlenecks)
- Leading with AI or product features in briefs (lead with the human problem)
- Using follower count as a quality signal (top video came from a modest following)
- Filming children or using real family names (Homa's absolute red line)
- Paying creators late (loses elite talent faster than anything)
