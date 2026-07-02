---
name: homa-capture-feedback
description: Capture the parent's reactions (👍 / 👎 / 🤷) on Homa's messages as training signal. Use when the parent reacts to one of your messages with thumbsup, thumbsdown, or shrug — log the event, for 👎/🤷 send ONE short follow-up, and route suggestion-quality reactions into the child's what-works model. Also use when running the weekly reaction-retro cron.
---

# Reaction Feedback

The parent is busy and on her phone. She rarely tells Homa "that was good" or "that missed" in words — but she will tap a reaction. Reactions are the highest-signal, lowest-friction feedback channel we have. This skill captures them and turns them into a learning loop.

## The Vocabulary

| Reaction | Means | Homa's response |
|---|---|---|
| 👍 `thumbsup` | nailed it | silent — log only |
| 👎 `thumbsdown` | missed | log + ONE short follow-up: *"what missed?"* |
| 🤷 `shrug` / `man-shrugging` / `woman-shrugging` | confused / gave up | log + ONE short follow-up: *"want me to try a different angle, or drop it?"* |

**Critical UX rules:**
- Follow-up = ONE message, max ~10 words. Never a wall of clarifying questions.
- If the parent doesn't reply to the follow-up, that's fine. Silence is a valid answer. **Never nag.**
- If the parent replies with a correction, capture it in the same record (`correction` field).
- 👍 is silent. Do NOT thank her or acknowledge — that's noise.

## The Log

File: `~/.openclaw/workspace/feedback.jsonl`

One JSON object per line. Append-only. Schema:

```json
{
  "ts": "2026-04-25T18:30:00Z",
  "channel": "{{MAIN_CHANNEL}}",
  "channel_name": "homa-homeschool",
  "reactor": "the parent",
  "reaction": "thumbsdown",
  "user_msg": "make a picture book of the child at the dog park...",
  "user_msg_ts": "1777155792.732849",
  "homa_msg_summary": "12-page PDF, illustrated, the child + Biscuit",
  "homa_msg_ts": "1777155799.111111",
  "tools_used": ["image_gen", "pdf_build"],
  "duration_s": 420,
  "session_id": "03e3ec57-...",
  "correction": null
}
```

**Field notes:**
- `user_msg`: the original prompt, truncated to ~200 chars
- `homa_msg_summary`: 1-line description of what Homa did (not the full message)
- `tools_used`: best-effort list of tool names called during the response
- `duration_s`: seconds from receiving the parent's message to sending Homa's response
- `correction`: filled in later if the parent replies to the follow-up

## When to Log

- **Anytime** the parent reacts to one of your messages with 👍, 👎, or 🤷 in any channel.
- Other reactions (❤️, 😂, 🎉, etc.) — don't log, just enjoy them.
- Reactions from anyone other than the parent (the partner, future humans) — don't log under this skill (different signal, different loop).

## Route SUGGESTION feedback into the what-works model (the personalization loop)

A reaction comes in two flavors, and they feed **two different** places:

1. **Feedback on Homa's behavior/tone/format** (a digest, a message style, a system action) → `feedback.jsonl` + the weekly retro to the partner (below). This improves Homa's *machinery*.
2. **Feedback on a SUGGESTION or artifact for a child** — an activity idea, a worksheet, a way to teach a concept — is a **labeled training point about what works for that child.** Log it to `feedback.jsonl` AND **append the pattern it implies to `content/learners/<child>/what-works.md`.** This is the Pinterest-style algorithm the partner asked for: every 👍/👎 on a suggestion tunes the next one.

For flavor 2, after logging, update what-works:
- **👍 on a suggestion** → append to "What's worked" with the date + what made it land (the hook/modality), e.g. *"2026-07-02 — counting via Paw Patrol pup-count → 👍 (character-carried math). (source: feedback)"*.
- **👎/🤷 on a suggestion** → append to "What he resists / needs more reps on" the pattern that missed (often: too generic, no character/sensory wrapper). If the parent's follow-up says *why*, capture that specific reason.
- Keep it one cited line per signal. Over weeks this is what lets Homa stop picking "the obvious suggestion" and start picking the one the child will sit down for.

**Before making the NEXT suggestion for that child, read `what-works.md` first.** Capture → model → better suggestion → capture is the loop; a reaction that doesn't update the model is a wasted signal.

## How to Append

```python
import json, datetime, pathlib

entry = {
    "ts": datetime.datetime.utcnow().isoformat() + "Z",
    "channel": "{{MAIN_CHANNEL}}",
    "channel_name": "homa-homeschool",
    "reactor": "the parent",
    "reaction": "thumbsdown",
    "user_msg": "...",
    "user_msg_ts": "...",
    "homa_msg_summary": "...",
    "homa_msg_ts": "...",
    "tools_used": ["..."],
    "duration_s": 0,
    "session_id": "...",
    "correction": None,
}
path = pathlib.Path.home() / ".openclaw" / "workspace" / "feedback.jsonl"
with path.open("a") as f:
    f.write(json.dumps(entry) + "\n")
```

If she replies to your follow-up with a correction, **rewrite the last line** of feedback.jsonl with `correction` filled in. Don't append a second line.

## The Weekly Retro

Cron `reaction-retro-weekly` runs every Sunday at 4pm ET (before "Sunday Evening Prep"). Its job:

1. Read the last 7 days of `feedback.jsonl`.
2. Cluster 👎 and 🤷 events by topic / pattern.
3. Identify wins (👍 patterns), misses (👎/🤷 patterns), and the single most actionable fix.
4. DM the digest to the partner (channel: his DM with Homa).

Digest format:

```
📊 the parent's feedback — week of {date_range}
👍 {n_up} · 👎 {n_down} · 🤷 {n_shrug}

Wins:
• {pattern} ({count}x)
• ...

Misses:
• {pattern} ({count}x) — {1-line corrections summary if available}
• ...

🎯 This week's #1 fix: {single most actionable change to memory, skill, or config}

Raw entries: ~/.openclaw/workspace/feedback.jsonl (last 7 days)
```

Keep it under 25 lines. The partner reads it on his phone too.

## Pinned Notice (one-time, for the partner to do manually)

The partner should pin this in the main channel so the parent knows reactions are meaningful:

> 👍 / 👎 / 🤷 on Homa's messages — that's how she learns. Tap whatever fits, no need to explain.

## What This Skill Is NOT For

- Reactions from the partner (different feedback loop, future)
- Reactions on the parent's own messages (those are Homa reacting to her, captured by `messages.statusReactions` config)
- Free-text feedback she sends in a fresh message (just respond normally and log it as a memory if significant)
