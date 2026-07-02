---
name: homa-capture-lesson
description: Turn a recorded lesson (the parent records ~10-15 min of school time on her phone and sends the audio) into what-works signal — transcribe it via Whisper, then mine it for the child's real engagement, resistance, and what landed, and append that to the what-works model + story-profile. The richest signal source Homa has: it hears the actual lesson, not a 30-second after-the-fact recap. Use when the parent sends a lesson recording / audio file, or says "here's a recording of today's lesson." Read content/learners/<child>/what-works.md FIRST.
---

# Homa Capture — Lesson Recording

**Read `content/learners/<child>/what-works.md` FIRST** — this skill *feeds* it, and you shape what you
extract by what the model already knows.

The parent's text/voice-note recaps are a summary. A **recorded lesson is the raw thing**: you hear where
the child lights up, where he stalls, the exact wording that made a concept click, the meltdown trigger,
the off-hand "again!" that says repeat-this. This is the single richest what-works signal source, and
what-works.md names it as an open experiment the parent agreed to: *"Lesson transcripts — the parent is open to
recording a 15-min lesson… Start with one."* (transcript 2026-06-28).

## When this fires
- The parent sends an **audio file** of a lesson (m4a/mp3/wav/ogg), or a voice note clearly *of* a lesson in
  progress (not a recap — you'll hear the child's voice / teaching happening live).
- The parent says "here's today's lesson" / "I recorded school time" / "listen to this."

If it's a short after-the-fact recap ("we did letter U again"), that's the **ambient/journal loop**, not
this. This is for *in-lesson* audio.

## Pipeline

1. **Get the file local.** If it came through Slack, download it (the download-file message action) to a
   temp path. Note the date of the lesson.
2. **Transcribe** with the proven helper:
   ```bash
   python3 scripts/transcribe-audio.py /path/to/lesson.m4a --out /tmp/lesson-YYYY-MM-DD.txt
   ```
   - Uses `OPENAI_API_KEY` against `api.openai.com` (whisper-1). Auto-chunks >20 min with ffmpeg.
   - **NOTE:** do NOT point Whisper at the Vercel AI Gateway — it 404s the audio endpoint
     (verified 2026-07-02). The helper already uses the correct base.
3. **Mine the transcript for signal** — read it as an educator, not a stenographer. Pull out, with the
   quote/timestamp as evidence:
   - **Engagement spikes** — where did the child get excited, ask for more, stay on task? What was the hook
     (a character? a manipulative? a story wrapper?).
   - **Resistance / stall** — where did he tune out, refuse, melt down? What preceded it (a worksheet? an
     abstract framing? being corrected?).
   - **What landed** — the exact phrasing/approach that made a concept click ("he got it when you said…").
   - **New position evidence** — did he demonstrate a skill above/below his tracked level? (e.g. added
     3+2 unprompted → math position signal.)
   - **Modality confirmation** — hands-on vs. worksheet vs. read-aloud: which carried the lesson.
4. **Write the signal where it compounds:**
   - **`content/learners/<child>/what-works.md`** — append dated, cited lines under the right section
     (What's worked / What he resists / Interests & hooks). This is the primary payoff.
   - **`story-profile.json`** — only if the lesson demonstrated a real position change (a new skill, a
     confirmed regression). Follow the story-coach profile conventions; don't over-write.
   - A short lesson note to the Obsidian vault (`_System/Research/` or the Daily Log) if it's worth the parent
     seeing.
5. **Log** a one-line run summary to `learning-journal.jsonl` (source: lesson-recording, signals_extracted:
   N) so the ambient loop and reflect can see it fired.
6. **Reply to the parent** — tight: the 2-3 highest-value things you heard + what you'll do with it. Not a
   transcript dump. If a pattern is strong, name the intervention it implies.

## Don't
- Don't dump the raw transcript at the parent. She recorded it so *Homa* would mine it, not so she'd re-read it.
- Don't invent signal — every extracted line needs a quote/moment behind it (same groundedness bar as the
  research + what-works loops).
- Don't route Whisper through the Vercel gateway (404s). Use the helper as-is.
- Don't over-update the profile from one lesson — engagement/resistance → what-works.md; hard position
  changes only when clearly demonstrated.

## Why this is a skill (recurs) not a one-shot
Recording lessons is meant to become a **habit** — the more the parent records, the sharper what-works gets,
the better every worksheet/activity/research output Homa produces (all 8 make-skills + story-coach now
read what-works.md first). It's the input side of the personalization keystone shipped 2026-06-29.

Built 2026-07-02 (reflect, Lens B) — roadmap queue #3. Whisper machinery verified on a real sample the
same night; `scripts/transcribe-audio.py` created + tested (8.6k chars from a real recording).
