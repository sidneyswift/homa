# marketing/ · the demand-gen engine

## What this folder is

The working state of Homa's B2C demand-gen pipeline: the signal reservoir, staged
and published content bundles, reader personas, the house voice, routine
definitions, and the deterministic scorer. The contract for how all of it behaves
is the spec, `docs/homa-planning/14-marketing-demand-engine.md`. The logic lives
as skills in `.agents/skills/marketing-*`; this folder is what those skills read
and write. The map of how steps chain is `workflows/demand-engine.md`.

## The laws

Read before doing anything in this folder. These are restated in every
`marketing-*` skill and every routine on purpose: no single edit can remove a rail.

1. **Never auto-publish.** Staged and committed in `content/drafts/` is the stop
   state of every unattended or agent-initiated run. Publishing is a
   human-triggered action, per format, via an explicit founder instruction like
   "publish <bundle> <formats>". No exceptions, including "just this once."
2. **Grounding is structural.** No source, no signal, no draft. Every signal file
   carries a `source` block whose `ref` resolves to a real file and whose
   `locator` is a verbatim quote or line range, never a paraphrase. Every claim
   in every draft traces back through its signal.
3. **Family data is banned.** `homa-macmini/`, `homa-research/`, and
   `homa-template/` are never signal sources and never appear in this folder.
   Field notes are anonymized at extraction: roles, never real names of moms or
   kids. Engagement data enters as aggregates only, never anything about an
   individual parent or child. Never use an `[inv]` (invented) persona quote from
   the planning docs in marketing copy; real verbatims only
   (journeys/01 §0 quote honesty rule).
4. **Voice laws** (repo AGENTS.md + `docs/homa-design/` + `voice/house-style.md`):
   no em dash, ever; "Homa" in prose, "HOMA" only in wordmark treatments;
   sentence case; reassure before inform; offers, never commands; no "behind"
   framing; never compare siblings; no fabricated numbers or social proof.
5. **No secrets here.** No API keys, tokens, or credentials in this folder or in
   any bundle. Resend, Postiz, and Higgsfield credentials live in env files and
   local tool config only.

## Folder map

| Path | What |
|---|---|
| `raw/` | Source material as it arrived: field notes, keyword exports, planning-doc excerpts |
| `signals/` | The reservoir: one atomic sourced idea per file, status new/queued/used/archived |
| `content/drafts/` | Staged bundles awaiting per-format human approval, one dir per bundle |
| `content/published/` | Bundles after publish, each with a `distribution.md` of canonical URLs |
| `personas/` | Reader personas the reviewer gate role-plays, pasted verbatim into its prompt |
| `voice/` | `house-style.md`: voice principles, hard bans, anti-slop banlist, format rules |
| `workflows/` | `demand-engine.md`: the pipeline map and per-step status |
| `routines/` | Schedule + literal prompt per routine, all shipped disabled |
| `evals/` | `score_bundle.py` (the deterministic floor) + `scorecards/` |

Growth map, created only when the first real file arrives, never as empty
folders: `reports/` (engagement loop output), `assets/` (reusable b-roll,
thumbnail templates, audio beds, Higgsfield references), `seo/` (keyword map,
content clusters), `swipe/` (saved hooks worth studying), `campaigns/`
(time-boxed pushes), `experiments/` (A/B results), `creators/` (collab tracking).

Never in this folder: positioning or persona source material (lives in
`docs/homa-planning/`, reference it), design tokens (`docs/homa-design/`),
anything from the three banned paths in law 3.

## How to run things

- **Stage a bundle:** founder says "run tonight's content" (or similar); the
  agent runs the `marketing-demand-engine` skill, which stages one bundle,
  scores it, commits, and stops.
- **Publish:** founder reviews `content/drafts/<bundle>/meta.yml`, flips chosen
  formats to `approved` (or asks the agent to), then says
  "publish <bundle> <formats>". The agent runs `marketing-distributor`, which
  publishes only approved formats and reports anything blocked.
- **Engagement:** founder says "run the engagement loop"; the agent runs
  `marketing-engagement-loop`.
- **Routines are disabled** (`routines/*.md`, `enabled: false`). Enabling one is
  a deliberate human act per `routines/runner.md`, and even enabled routines
  only stage, never publish (law 1).
