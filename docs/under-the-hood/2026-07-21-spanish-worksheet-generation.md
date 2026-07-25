# Under the Hood: Spanish Worksheet Generation

**Date:** 2026-07-21
**Subject:** How Homa turned "make me a Spanish coloring sheet" into two printed, vocabulary-labeled, kid-personalized worksheets — traced end to end from session `7a1c0219` (#homa-homeschool thread, ~9:30–9:49am ET).
**Purpose of this series:** Document the mechanisms behind Homa's output quality so they can be recreated in the Homa cloud app. The cloud app uses a different harness (not OpenClaw), so each section separates the **concept** (portable) from the **OpenClaw implementation** (replaceable) and notes **gaps** the new architecture must fill.

---

## The interaction (raw trace)

Request chain from Alessa, all in one Slack thread:

1. "Can you please make me a Spanish coloring sheet with kitchen and baking items, a cakes, sprinkles and story in the kitchen"
2. "Do this in the other Homa too" (Sidney) → Homa correctly recognized it cannot reach a separate instance
3. "Homa just make it yourself" → built a second variant sheet
4. "Print 2 copies" → printed one of each
5. "Yes print both" / "Print both again" → second copy of each

Agent model: `claude-opus-4-8`, extended thinking **off**. Total wall time ~19 minutes including two generations, one edit-repair, three vision verifications, filing, and two print runs.

---

## Layer 1: Always-loaded context (the bootstrap)

**Concept:** The agent never starts cold. A small set of curated files is injected into every session before the user's message is read. This is why Homa "just knows" who Story is, what Less cares about, and where things go — zero lookups required for the basics.

**OpenClaw implementation:** Workspace bootstrap files auto-injected each session:
- `AGENTS.md` — operating rules, skill index, filing law. **Hard 20,000-char injection limit** — over it, OpenClaw silently truncates and the agent runs half-blind (bit us 2026-07-21; trimmed 27.5K→19.2K).
- `USER.md` — who Less is, and critically Story's profile including his **physical description**: "Shoulder-length blonde hair, blue eyes, pale skin" plus interests (Paw Patrol, Mondrian, space, magnets) and favorite colors.
- `MEMORY.md` — curated long-term memory (~70 lines, aggressively pruned).

**Why it matters for quality:** The likeness description that made the boy on the page look like Story came straight from always-loaded USER.md — the agent didn't search for it, it was simply *there*.

**Porting notes / gaps:**
- Cloud app needs an equivalent injection layer: per-family profile doc + operating rules doc, loaded into every session's system context.
- Enforce a size budget with a *loud* failure (OpenClaw's silent truncation is a footgun — replicate the limit, not the silence).
- Keep bootstrap docs curated and small; push detail into on-demand files (see Layer 2).

---

## Layer 2: Skills (codified craft, loaded on demand)

**Concept:** Reusable playbooks that encode accumulated trial-and-error, so quality compounds instead of being rediscovered per request. The agent routes the request to a skill, reads it, and follows it. This is the single biggest "so good" factor: the skill file contains prompt engineering that took weeks to learn.

**OpenClaw implementation:** `workspace/skills/homa-<category>-<what>/SKILL.md` (naming enforced by the doctor). First tool call of the session was reading `skills/homa-make-coloring-pages/SKILL.md`. What that file encodes:

- **Two modes with a routing rule:** photo provided → `nano-banana-pro/edit` (preserves real likeness); no photo → `nano-banana-2` text-to-image. Explicit rationale recorded: "NB2 text-to-image generates generic people that don't look like the actual photo subjects" (Less requested the photo workflow 2026-05-05).
- **A base prompt template** with the load-bearing phrases: *"bold thick black outlines"* (without it NB2 adds shading), *"pure white background"*, *"large simple shapes"*, plus explicit negatives *"no shading, no gray tones, no color, no fill"*.
- **Model pin:** "Nano Banana 2 for text-to-image — never Flux."
- **A pre-delivery quality checklist** (pure black lines, thick enough for a 3-year-old, no text artifacts, toddler-simple).
- **Past successes log** (Mondrian butterfly, gymnastics cat, astronaut) — few-shot grounding for what "good" looks like.
- **Cross-references:** "Read `content/learners/story/what-works.md` FIRST" (personalization) and "FILE OUTPUT TO THE BINDER" (filing law) — the skill wires itself into the other layers.

**Judgment on top of the skill:** The skill says "no text in the image." Homa recognized this request was a *Spanish vocabulary* sheet and deliberately broke that rule — baking 8 labeled vocab words into the art, with "spelled exactly as given" in the prompt. Skills are strong defaults, not shackles; the agent is allowed to override with a reason.

**Porting notes / gaps:**
- Cloud app needs a skill registry with per-task markdown playbooks and a routing step (description-matching is enough; that's all OpenClaw does).
- The *content* of the skill files is directly portable — copy the prompt templates, model pins, and checklists verbatim.
- Gap: a feedback path that keeps skills alive (Homa's nightly reflect + reaction-feedback loop updates them; a static copy will rot).

---

## Layer 3: Personalization (the learner model)

**Concept:** Two artifacts turn generic output into *Story's* output — a likeness description and a what-works file.

**OpenClaw implementation:**
1. **Likeness as text:** USER.md's two-line physical description, plus a canonical reusable character string in `skills/homa-make-picture-book/SKILL.md`:
   `STORY = "a young boy character with shoulder-length wavy blonde hair and bright blue eyes, pale skin, rosy cheeks, wearing a red t-shirt and blue shorts"`
   Used for cross-page consistency in books; today's prompt used the matching fragment "a happy young boy with shoulder-length wavy hair."
2. **Reference photos:** 12 real photos in `workspace/reference-images/story/` (added 2026-04-04). Homa checked the folder (the skill's photo-mode routing requires knowing if photos are available) but did **not** pass one — this run was text-only.
3. **What-works file:** `content/learners/story/what-works.md` — how Story actually learns (hands-on, character-carried; few worksheets), read before building.

**A subtle quality move:** Homa dropped "blonde, blue eyes, pale skin" from the generation prompt — color attributes are meaningless in black-and-white line art and would fight the "no fill, no shading" constraints. Likeness got compressed to what survives the medium: hair length + wavy.

**Porting notes / gaps:**
- Port the pattern: per-child profile with (a) a canonical character prompt-string, (b) reference photos, (c) a what-works learning-style doc. All three are just data — trivially portable.
- Untapped upgrade for either system: pass a reference photo into Pro Edit as an identity anchor alongside the scene prompt for true likeness in generated (not photo-converted) scenes. Pieces exist; workflow not yet built.

---

## Layer 4: Generation pipeline

**Concept:** One strong image model, called with battle-tested settings, via plain scripting (no fragile UI automation).

**OpenClaw implementation:** Python + `fal_client` written to a temp script and executed. Sheet 1 call:

```python
prompt = (
    "Simple black and white coloring page for a young child, bold thick black outlines on pure white background, "
    "no shading, no gray tones, no color, no fill, large simple shapes, clean line art, printable coloring book style. "
    "Scene: a happy young boy with shoulder-length wavy hair standing in a cozy kitchen, wearing an apron and a chef hat, "
    "baking. Around him are baking items each with a clear printed Spanish label beneath it in simple neat capital letters: "
    "a layered CAKE labeled 'EL PASTEL', a shaker of SPRINKLES labeled 'LAS CHISPAS', a mixing BOWL labeled 'EL TAZON', "
    "a WHISK labeled 'EL BATIDOR', a rolling pin labeled 'EL RODILLO', an OVEN labeled 'EL HORNO', "
    "a cupcake labeled 'EL PASTELITO', and a wooden SPOON labeled 'LA CUCHARA'. "
    "The boy in the center. Labels are in clean readable block letters, spelled exactly as given. "
    "Everything is empty outline ready to color."
)
payload = {"prompt": prompt, "aspect_ratio": "3:4", "output_format": "jpeg", "resolution": "2K", "num_images": 1}
res = fal_client.subscribe("fal-ai/nano-banana-2", arguments=payload)
```

**Settings that matter:**
- `aspect_ratio: "3:4"` — portrait, fills letter paper (skill default is 1:1 for single subjects; 3:4 chosen because a labeled multi-item scene needs vertical space).
- `resolution: "2K"` — above the skill's documented 1K default; crisper lines at print size.
- `output_format: "jpeg"`, `num_images: 1`.
- API key: literal Bearer token in `openclaw.json` MCP config for the MCP path; `FAL_API_KEY` env for the Python path. **Transport gotcha (2026-07-21):** fal's MCP endpoint dropped SSE — must use `transportType: "streamable-http"` or image gen silently dies at gateway boot.

**Prompt anatomy (why it works):**
1. *Style contract first* — the coloring-page style block, verbatim from the skill.
2. *Scene* — personalized subject in a concrete setting.
3. *Enumerated content* — 8 items, each with its exact label in quotes, "spelled exactly as given" (text rendering in image models needs this explicitness).
4. *Composition + closing constraint* — "boy in the center… empty outline ready to color."

**Porting notes / gaps:**
- Direct API calls (fal REST or client lib) are the portable path — do not depend on MCP plumbing in the cloud app.
- Port the exact payloads; they're harness-independent.

---

## Layer 5: The verify → repair loop (the actual secret)

**Concept:** Never deliver an unexamined generation. The agent inspects its own output with vision, with *specific falsifiable questions*, and repairs surgically rather than regenerating.

**OpenClaw implementation (this session, three inspections):**

1. Post-gen check, sheet 1: *"Describe this coloring page. Are the lines clean black outlines on white (no gray shading)? List EXACTLY what Spanish text labels appear and whether they are spelled correctly. Is there a boy in the kitchen scene with cake and sprinkles?"*
   → **Caught a defect:** the spoon label read "SPOON / LA CUCHARA".
2. **Surgical repair** via `fal-ai/nano-banana-pro/edit` (image upload + targeted prompt): *"Remove the English word 'SPOON' and the slash so the label reads ONLY 'LA CUCHARA' in the same clean block letters. Keep everything else in the image exactly the same."* — preserves the approved 95% instead of re-rolling the dice with a full regen.
3. Re-verify the fix: *"Does the spoon label now read only 'LA CUCHARA' with no English word 'SPOON'?"*
4. Sheet 2 got the same treatment, including a judgment call: missing accent on "AZUCAR" accepted as standard for all-caps — verification with domain sense, not blind rejection.

**Why this is the differentiator:** Image models misspell and drop stray words constantly. Every parent-facing tool that skips this step ships those errors. The loop costs one extra vision call and occasionally one edit call — seconds — and is invisible in the final product except as "the worksheets are so good."

**Porting notes / gaps:**
- Portable as a 3-step pattern: generate → vision-check with an exact expected-content checklist (derived from the generation prompt) → targeted edit-repair → re-check. Any vision-capable model works as the checker.
- Key design detail: the checker prompt asks for *exact transcription* of text in the image, not "does this look good?" Vague checks pass bad output.

---

## Layer 6: Filing, delivery, print

**Concept:** Output lands in a durable, browsable home (not just chat scroll), and delivery includes the physical last mile.

**OpenClaw implementation:**
- Filed to `content/curriculum/spanish/worksheets/kitchen-baking-coloring/` with a README logging date, request, vocab list, and generation provenance ("NB2 text-to-image, 3:4, spoon label fixed via NB Pro Edit"). This is the "binder" — the curriculum library mirrors Less's Obsidian vault taxonomy; chat-scroll loss was her #1 pain (2026-06-28 transcript), and the skill hard-codes the filing rule.
- Delivered to Slack in-thread with the vocab list written out.
- Printed via CUPS: `lp -o media=Letter -o fit-to-page <file>` to the HP Color LaserJet MFP M277dw (IPP non-SSL due to expired cert). On ambiguity ("2 copies" — two of one, or one of each?) it printed one of each and *said so with an offer to correct* — resolve-and-disclose instead of blocking on a clarifying question.

**Porting notes / gaps:**
- Cloud app gap #1: **printing.** No local CUPS. Options: email-to-print, a thin local print agent, or Google Cloud Print successors (e.g., HP ePrint for this printer).
- Cloud app gap #2: **durable library.** Needs a real content store with the curriculum taxonomy (subject → worksheets → artifact folder + provenance metadata), not just chat attachments.
- Portable behavior rule: on ambiguous quantity/scope, act on the most reasonable reading and disclose — matches the household norm (output over plan-approval).

---

## Summary: the portable formula

```
always-loaded family context          (who Story is, house rules)
  → skill playbook                    (accumulated prompt craft, model pins, checklists)
    → learner personalization         (character string + what-works + reference photos)
      → strong model, exact settings  (NB2, 3:4, 2K, style-contract prompt)
        → verify/repair loop          (vision-check exact text → surgical edit → re-check)
          → file + deliver + print    (binder taxonomy, in-thread delivery, physical copy)
```

Every layer is data + pattern, not OpenClaw magic. The harness-specific parts are only: context injection mechanics, the tool runtime (exec/read/image), MCP plumbing, and local print access. The quality lives in the files and the loop — both portable.

## Known gaps to fill in the cloud architecture

1. Bootstrap/context-injection equivalent with a loud size budget.
2. Skill registry + routing, plus a feedback mechanism so skills keep improving (reaction-feedback 👍/👎 + nightly reflect are the OpenClaw organs to re-imagine).
3. Content library with taxonomy + provenance (replaces workspace filesystem + git brain-snapshot).
4. Print bridge (no local CUPS in the cloud).
5. Vision-verify loop as a first-class pipeline stage, not agent goodwill.
6. Identity-anchored generation (reference photo → Pro Edit) — unbuilt in both systems; free quality win.
