# Workflow · demand engine

The end-to-end map of the pipeline. This file names the skills it chains, it
never re-explains their steps: each skill's `SKILL.md` owns its own how, each
routine file owns its own when. Spec: `docs/homa-planning/14-marketing-demand-engine.md`.

## The map

```mermaid
flowchart TD
  raw["raw/ field notes, keyword research"] -->|"marketing-signal-extraction"| sig[("signals/")]
  gen["marketing-idea-generator tops up when thin"] --> sig
  sig -->|"pick strongest unused, dedup first"| eng["marketing-demand-engine orchestrator"]
  eng --> art["ARTICLE lane: SEO pillar draft"]
  eng --> vid["VIDEO lane: script draft"]
  art --> g1["reader gate (blog-reader), then editor gate"]
  vid --> g2["reader gate (shortform-viewer), then editor gate"]
  g1 --> email["EMAIL derived from gated article"]
  email --> g3["reader gate (waitlist-subscriber), then editor gate"]
  g1 --> micro["derive micro-copy: captions x4, pin, X post"]
  g2 --> micro
  micro --> g4["reader pass per persona batch, one editor pass over the set"]
  g4 --> assets["generate assets: Higgsfield video + thumbnail, blog hero, pin image"]
  g3 --> manifest
  assets --> manifest["meta.yml: per-format approval states"]
  manifest --> score["evals/score_bundle.py writes scorecard"]
  score --> staged[("content/drafts/date-slug/ STOP")]
  staged -->|"human approves or kills PER FORMAT"| pub["marketing-distributor, manual trigger only"]
  pub --> tracked["content/published/ + distribution.md"]
  tracked -.->|"weekly analytics + waitlist deltas"| sig
```

## Steps and status

Status values: `works` (runnable today) · `staged-only` (produces the artifact,
cannot ship it yet) · `blocked-on-human` (named human steps required) ·
`disabled` (built, deliberately off).

| # | Step | Skill | Status |
|---|---|---|---|
| 1 | Extract raw into atomic sourced signals | `marketing-signal-extraction` | works |
| 2 | Top up the reservoir when thin | `marketing-idea-generator` | works |
| 3 | Orchestrate one bundle end to end | `marketing-demand-engine` | works |
| 4 | Reader gate (persona role-play, notes only) | `marketing-copy-reviewer` | works |
| 5 | Editor gate (house style, notes only) | `marketing-copy-editor` | works |
| 6 | Draft the SEO pillar article | `marketing-article-writer` | works |
| 7 | Script + generate the shortform video | `marketing-video-producer` | works (Higgsfield CLI authed) |
| 8 | Derive the waitlist nurture email | `marketing-email-writer` | staged-only (DM7 consent ruling open, spec §10) |
| 9 | Blog hero, figures, pin image | `marketing-illustrator` | works |
| 10 | Publish approved formats: blog | `marketing-distributor` | works (git is the channel) |
| 11 | Publish approved formats: TikTok, Instagram, Pinterest, Facebook, YouTube, X | `marketing-distributor` | blocked-on-human: register @thankshoma handles, create the YouTube channel, connect each account in Postiz, run `postiz auth:login` (HUMAN-TODO) |
| 12 | Send the email | `marketing-distributor` | blocked-on-human: founder ruling DM7 (HUMAN-TODO) |
| 13 | Weekly analytics into reports + engagement signals | `marketing-engagement-loop` | staged-only until first social publishes; waitlist deltas work now |
| 14 | Reservoir hygiene + scorecard trends | `marketing-janitor` | works |
| 15 | Nightly staging run, 04:00 ET | `routines/nightly-content.md` | disabled (DM4, manual-first) |
| 16 | Monday engagement run | `routines/weekly-engagement.md` | disabled (DM4) |

Update the status column when reality changes (a handle gets connected, DM7 gets
ruled, a routine gets enabled). This table is the honest state of the engine.
