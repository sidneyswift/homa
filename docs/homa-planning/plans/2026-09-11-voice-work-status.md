# Voice work visibility and completion, gh#1150

The parent saw Homa promise a worksheet during web voice, but had no visible work status and did not hear delivery. Web discarded the real onWorking callback. The displayed transcript also contained a second greeting before the worksheet; whether the parent restarted that test call is unconfirmed.

## Behavior

- Reserve an inline result position when authenticated backend work begins. Keep it pending independently of microphone state; use no guessed stages or completion percentages.
- Replace the pending view with real tool receipts or a labeled text outcome. Transport uncertainty remains an honest failure and never retries the action.
- Preserve a polite status region across pending and completion.
- The originating call relays the backend answer. A replacement call receives only a short notice for a newly completed result, never the old question, prior transcript, or backend continuation. Only a final, review-passed material selected by the existing visibility policy earns the printable-ready notice.
- Work completed while voice is off remains visual and is not replayed into a later call. Closing the page is outside this client-owned progress lifetime.

## Evidence

Focused voice tests cover work start/end identity, ambiguous failure, closed-call effects, uninterrupted delayed completion, deduplication, and handoff boundaries including draft/unreviewed/superseded material negatives. Native compatibility checks pass for the shared callback change.

A local browser harness bundled the actual VoiceMode, VoiceWorkStatus, LiveVoiceConversation, and session route, with synthetic authentication, synthetic audio, and delayed synthetic backend results. The real GPT Live 1 / Gleam provider generated completion speech in an uninterrupted call and the short printable-ready notice in a replacement call. No real family data or worksheet writes were used by this harness.

Independent source review identified contrast, live-region lifetime, duplicate-looking prose and cross-call continuation hazards. All were addressed. Rendered review found readable text, clean wrapping and no overlap in desktop and narrow viewport captures. Temporary evidence: /private/tmp/homa-1150-progress.png, /private/tmp/homa-1150-progress-320.png, /private/tmp/homa-1150-restarted-call.txt. The narrow capture used a requested 320 CSS-pixel viewport; its rendered image dimensions differ. No actual screen-reader or physical-device spoken-turn certification is claimed. Full production scrolling remains a separate live readback.

Design owner: existing chat surface gh#685. This change reuses paper frame and semantic text atoms. The required inventory regeneration also registers two already-shipped family-authenticated route handlers omitted from both boundary registries: materials/[id]/print/pdf and voice/live/session. Inventory source evidence is not rendered acceptance of other surfaces.
