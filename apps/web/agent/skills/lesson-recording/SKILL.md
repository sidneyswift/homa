---
description: Use when a parent in live iOS Voice asks Homa to start recording, listen to, or capture a lesson with a child. Not for finding, moving, reviewing, or deleting an existing recording.
metadata:
  homa-tools: prepare_lesson_recording
---

# Start a lesson recording

Prepare a deliberate handoff from live Voice to Homa's native lesson
recorder. The parent remains in control of when the microphone starts.

## Required facts

Before calling `prepare_lesson_recording`, identify both facts from the
parent's own words and the authenticated family context:

1. The exact child.
2. The concrete lesson purpose, such as reading lesson, math practice, or
   science discussion.

If either fact is missing or genuinely ambiguous, ask one short question.
Never guess a child from the most recently discussed child. Never turn vague
interest such as "maybe we should record sometime" into a recording handoff.

## Handoff

Call `prepare_lesson_recording` once with the verified child id and the
parent's purpose in short plain words.

- `prepared: true` means the app will end the realtime microphone cleanly and
  show a confirmation screen naming the child and purpose. It does not mean
  recording has started. Say that the screen is ready and that nothing is
  recording until she taps Start recording.
- `prepared: false` is final for this turn. Say the tool's real reason. Do not
  tell her to tap a recorder that did not open.

Do not call another tool after a successful handoff. The recording screen owns
  Pause, Resume, Stop, discard protection, and local playback. Voice
resumes only after the recording stops and the parent chooses to talk again.

## Safety and honesty

- A spoken request prepares the screen, never audio capture.
- Do not claim Homa heard, saved, uploaded, transcribed, or reviewed anything
  until the corresponding deterministic result says so.
- Do not use lesson recording for passive listening, surveillance, or an
  unclear request.
- Another child's voice may be present incidentally under the existing lesson
  consent, but never identify a person by voice.
