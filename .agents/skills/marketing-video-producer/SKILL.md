---
name: marketing-video-producer
description: The video lane's pillar, in two phases. Script phase writes video/script.md (2-second hook, 3 to 5 beats, CTA, shot plan) which gets the full two-gate treatment BEFORE any generation spend. Generation phase renders the 9:16 video via the higgsfield-generate skill plus a thumbnail into the bundle. Invoked by marketing-demand-engine. NOT for topic choice (marketing-demand-engine), captions (derived by the orchestrator), or still images (marketing-illustrator).
---

# Marketing video producer

Script first, spend second. The script is a pillar: it passes the
shortform-viewer reader gate and the editor gate before a single generation
credit is spent, because regenerating video is expensive and regating copy is
cheap.

## Phase 1 · script

1. Read the assigned signal (and the gated article if it exists; the lanes
   share one idea) plus `marketing/voice/house-style.md` format rules.
2. Write `video/script.md` in the bundle:

```markdown
# <working title>

hook: "<the first thing seen/heard; must land inside 2 seconds>"
length-target: 25s

## Beats
1. HOOK (0-2s): <on-screen text + spoken line + shot>
2. <beat> (2-9s): <on-screen text + spoken line + shot>
3. <beat> (9-18s): ...
4. CTA (last 4s): <one offer, thankshoma.com or the article>

## Shot plan
- Beat 1: <what the frame shows, camera, mood>
- ...

## Sound-off plan
<what a muted viewer reads: caption text per beat>
```

   Rules: 3 to 5 beats, 20 to 40 seconds, one idea, one CTA, kitchen-table
   texture over polish, no product shots in the first second, and the
   sound-off plan is mandatory (most viewers are muted).
3. Hand back to the orchestrator for gates (shortform-viewer persona, then
   editor). Do not start Phase 2 until the gated rewrite is done.

## Phase 2 · generation (only after gates)

1. Follow the installed `higgsfield-generate` skill (`.agents/skills/
   higgsfield-generate/SKILL.md`) for model choice and submission. Defaults
   for this pipeline: `seedance_2_0` for the video, one `generate create` per
   continuous shot, `--aspect_ratio 9:16`, `--wait`. Example shape (validate
   params per that skill before running):

```bash
higgsfield generate create seedance_2_0 --prompt "<beat's shot description>" --aspect_ratio 9:16 --duration 12 --wait
```

2. Download outputs into the bundle as `video/video.mp4`. If the script needs
   multiple generated shots, note each URL in script.md; assembling cuts
   happens per the higgsfield-generate skill's workflow tools, or stage the
   single strongest continuous take (a 20 to 30 second single take is fine
   for v1; do not over-produce).
3. Thumbnail: `gpt_image_2`, `--aspect_ratio 9:16`, prompt from the hook
   frame, save as `video/thumbnail.png`. Legible at grid size.
4. Reproducibility: append to the bottom of `script.md` the model, full
   prompt, and job URL for every generated asset.

## Laws (marketing/AGENTS.md, restated)

Never auto-publish (rendered video stages in the bundle only). No real
children's faces, no member family likenesses, no fabricated product
screenshots. No source, no claim in the script. Voice per
`marketing/voice/house-style.md`.
