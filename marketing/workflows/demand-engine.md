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

Status is evidence-scoped and dated 2026-07-11. `local-only` means the skill
and its local inputs exist but no end-to-end run was verified in this audit.
`staged-only` means an external account is reachable but no current output or
delivery was verified. `blocked-on-human` names the missing decision or account
step. `disabled` means the schedule is deliberately off and not installed.

| # | Step | Skill | Status |
|---|---|---|---|
| 1 | Extract raw into atomic sourced signals | `marketing-signal-extraction` | local-only; not run in this audit |
| 2 | Top up the reservoir when thin | `marketing-idea-generator` | local-only; not run in this audit |
| 3 | Orchestrate one bundle end to end | `marketing-demand-engine` | local-only; no current complete bundle run verified |
| 4 | Reader gate (persona role-play, notes only) | `marketing-copy-reviewer` | local-only; instruction present |
| 5 | Editor gate (house style, notes only) | `marketing-copy-editor` | local-only; instruction present |
| 6 | Draft the SEO pillar article | `marketing-article-writer` | local-only; no approved article exists |
| 7 | Script + generate the shortform video | `marketing-video-producer` | staged-only; Higgsfield account access verified, generation unverified |
| 8 | Derive the legacy-waitlist nurture email | `marketing-email-writer` | blocked-on-human: DM7 consent ruling open |
| 9 | Blog hero, figures, pin image | `marketing-illustrator` | staged-only; Higgsfield account access verified, generation unverified |
| 10 | Publish approved formats: blog | `marketing-distributor` | local-only; current skill stops after local copy, build, and commit, so push, READY, and live probe are unverified |
| 11 | Publish approved formats: TikTok, Instagram, Pinterest, Facebook, YouTube, X | `marketing-distributor` | blocked-on-human: register @thankshoma handles, create the YouTube channel, connect each account in Postiz, run `postiz auth:login` (HUMAN-TODO) |
| 12 | Send the email | `marketing-distributor` | blocked-on-human: DM7; Resend delivery was not verified |
| 13 | Weekly analytics into reports + engagement signals | `marketing-engagement-loop` | blocked-on-human: no published social data, Postiz unauthenticated, waitlist data not inspected |
| 14 | Reservoir hygiene + scorecard trends | `marketing-janitor` | local-only; instruction present, not run in this audit |
| 15 | Nightly staging run, 04:00 ET | `routines/nightly-content.md` | disabled; no scheduler installed |
| 16 | Monday engagement run | `routines/weekly-engagement.md` | disabled; no scheduler installed |

Update the status column only after recording the matching local command,
provider, deployment, or data evidence. Repository presence alone does not
promote a row to working.
