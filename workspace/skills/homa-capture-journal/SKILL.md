---
name: homa-capture-journal
description: Daily one-question journal prompt to the parent in #homa-journal ({{JOURNAL_CHANNEL}}). Captures the parent's and partner's replies as the day-to-day signal of what's actually going on, then routes the info into the right systems (compliance log, the relevant child's children/<child>.json, MEMORY, etc). Use when running the daily-prompt cron, AND whenever the parent or partner posts in #homa-journal.
---

# Homa Journal

The journal channel is the lowest-friction way the parent can tell Homa what happened today. One simple, broad question per day. Easy to answer, easy to skip. The richness comes from accumulation, not depth.

## Channel
- ID: `{{JOURNAL_CHANNEL}}`
- Name: `#homa-journal`
- Subscribed in `openclaw.json` with `requireMention: false`

## Two modes

### Mode 1 — Daily prompt (cron-driven)

Cron `Homa Journal Prompt` runs once a day at 8:00pm ET. The cron job's job:

1. **Check whether to post** — look at the most recent message Homa sent in `{{JOURNAL_CHANNEL}}`.
   - If that message has any reply (in-channel or threaded), proceed to step 2.
   - If that message has zero replies, **skip silently**. Do not post a new question. Don't log anything visible. The previous one is still waiting — spamming defeats the point.
   - If the channel has no prior Homa message at all (first run), proceed to step 2.

2. **Pick a question** — pull one prompt from the rotation below. Avoid picking the same one as the most recent two posts. Do not generate elaborate prompts; brevity is the whole point.

3. **Post it** — single message, no thread. Casual tone. Examples (rotate, don't repeat in sequence):
   - "Tell me something that happened today."
   - "Anything new with the child?"
   - "What did the child do today that surprised you?"
   - "Got any updates?"
   - "What's something that worked today? What didn't?"
   - "What's on your mind?"
   - "Anything you want me to remember?"
   - "Any wins from today, big or small?"
   - "What's something the child said today?"
   - "Anything coming up this week I should know about?"
   - "What did you do today that you want to remember?"
   - "How was today?"
   - "Any 'huh, didn't expect that' moments today?"
   - "Anything I should pull into the vault?"

4. **No follow-up.** Don't ping again. Don't react to silence. The unanswered-check on the NEXT day's run is the only enforcement.

### Mode 2 — Capture (event-driven)

When the parent or partner posts in `#homa-journal`, Homa is invoked because the channel is in `requireMention: false`. Homa's job:

1. **Acknowledge briefly** — one short reply. Warm, not effusive. Examples: "Got it.", "Saved.", "Logged — that's a good one.", "Noted, I'll fold it in." If the post asks a question or wants action, do that first; the logging happens regardless.

2. **Append to the journal log** — `~/.openclaw/workspace/journal.jsonl`, one JSON object per line:
   ```json
   {
     "ts": "2026-05-05T20:14:00Z",
     "channel": "{{JOURNAL_CHANNEL}}",
     "user": "the parent" | "the partner",
     "user_id": "U...",
     "msg_ts": "1777155792.732849",
     "thread_ts": "1777155700.000000" | null,
     "prompt_question": "Anything new with the child?" | null,
     "text": "raw message text",
     "tags": ["math", "co-op", ...],
     "child": "<child>" | null,
     "routed_to": ["obsidian:daily-log", "children/<child>:math", "memory:..."]
   }
   ```

3. **Route the substance to the systems that matter.** This is the whole reason this channel exists — accumulating data without routing is hoarding. Decide and act:

   - **Always** → append a bullet to today's **compliance log**: `~/.openclaw/workspace/content/compliance/{YYYY-MM-DD}.md` (create with a header if missing; one bullet per journal entry, prefixed with the time and `(the parent)` or `(the partner)`). **This is the state-report capture — NOT the vault.** The parent explicitly doesn't want daily logs cluttering her Obsidian binder ("I don't know why she's logging these"), but they're captured here for the state submission she'll need at the child's compulsory age (~2027). Her binder stays curriculum-only.

   - **If child-related** (something a child did, said, learned, struggled with) → consider updating that child's `~/.openclaw/workspace/children/<child>.json` profile. First resolve **which child** the reply is about: if the reply names or clearly implies a specific child, use that child's `children/<child>.json`. If it's ambiguous and only ONE `children/*.json` exists, use that one. If it's ambiguous and multiple children exist, ask the parent which child it's about (or leave it in the compliance log only) rather than guessing. Then:
     - If it's an observation about a specific subdomain (e.g. "she counted to 30 today") → bump that subdomain's `last_observed` and add a 1-line note. Don't overwrite confidence levels — that's the weekly scoring cron's job.
     - If it's a NEW skill emerging that isn't in the profile → add to the appropriate domain's `notes` array.
     - **After ANY write to a `children/<child>.json`, run `python3 scripts/regenerate_vault.py`** (it rebuilds all children's vault views) so the vault stays in sync.

   - **If it's a persistent fact about the parent, partner, or the family** that future Homa sessions need to know (preferences, schedule changes, life events, decisions, vendor changes) → write a memory file under `/Users/mac/.claude/projects/-Users-mac--openclaw/memory/` and add a one-line index entry to `MEMORY.md` per the auto-memory rules.

   - **If it references a date/event** (appointments, deadlines, co-op weeks) → check whether it's already in `gog calendar` for `{{PARENT_EMAIL}}`. If not, surface it back ("Want me to add this to your calendar?") — do not auto-create calendar events without confirmation.

   - **If it's a vault-worthy decision** (curriculum change, schedule shift, methodology choice) → update the relevant page in the Obsidian vault (Subjects/, Schedule.md, etc) and bump its freshness banner.

   - **Don't route** purely emotional/social content ("today was rough", "the child was a goofball at lunch") beyond the compliance log. The compliance log captures it; resist the urge to over-systematize feelings.

4. **Fill `routed_to`** in the journal.jsonl entry with every destination touched. This makes audits possible.

5. **If the response was vague** (e.g. "fine", "nothing", "ok") — log it, no routing, no follow-up question. Don't push. The point is friction-free; some days nothing's there.

## Question Selection Algorithm

Inside the cron prompt:

```python
import json, pathlib, random
QUESTIONS = [
    "Tell me something that happened today.",
    "Anything new with the child?",
    "What did the child do today that surprised you?",
    "Got any updates?",
    "What's something that worked today? What didn't?",
    "What's on your mind?",
    "Anything you want me to remember?",
    "Any wins from today, big or small?",
    "What's something the child said today?",
    "Anything coming up this week I should know about?",
    "What did you do today that you want to remember?",
    "How was today?",
    "Any 'huh, didn't expect that' moments today?",
    "Anything I should pull into the vault?",
]
# avoid the last 2 used; record the chosen one to journal-prompts.jsonl
```

Track recently-used questions in `~/.openclaw/workspace/journal-prompts.jsonl` (one entry per posted prompt, with ts and question text) so the cron can avoid repeats.

## What This Skill Is NOT For

- Other channels (#homa-homeschool, #homa-research, #homa-dashboard) have their own loops — don't post journal questions there, don't log #homa-homeschool replies as journal entries.
- Long therapy-style follow-ups. The daily prompt is one question, no probing.
- Auto-creating calendar events, sharing docs, or any other "explicit permission" actions — surface and ask, never act unilaterally.
- Pinging the parent when she's silent. Silence is fine.

## Pinned Notice (one-time, for the partner to do manually)

The partner should pin this in #homa-journal so the channel's purpose is obvious:

> One question a day. Reply if you've got something, skip if you don't — Homa won't ask again until you've responded. She'll fold what you share into the vault, the right child's profile, and memory.
