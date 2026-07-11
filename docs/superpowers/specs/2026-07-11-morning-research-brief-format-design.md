# Morning research brief format design

> Status: approved in chat by the founder on 2026-07-11. This document
> formalizes the approved words and constraints before implementation.

## Goal

Make the cloud morning research text match the scannable Mac Mini format the
founder prefers: name the topic, separate the research finding from the
family-specific application, then offer one action Homa can perform.

## Exact output contract

```text
🔬 Last night I researched {topic}

What I learned: {1 to 2 sentences about the research itself.}

Why it's interesting: {1 to 2 sentences connecting the finding to this child.}

Want me to {one specific action Homa can complete}?
```

The labels and blank lines are required. The topic uses a plain parent-facing
name such as `phonics`, `self-regulation`, or `fine motor skills`.

The headline must remain truthful. The normal fleet-backed brief says `Last
night`. If the family's one allowed top-up search actually runs that morning,
the headline says `🔬 This morning I researched {topic}` and every other block
stays identical.

## Content rules

### What I learned

- One or two sentences.
- States the finding, not the child's progress.
- Uses only evidence present in the selected knowledge-bank row or the one
  allowed top-up search.
- May name a study, framework, or evidence source when the research context
  supports it.
- Uses plain language. No internal taxonomy ids or score vocabulary.

### Why it's interesting

- One or two sentences.
- Names the relevant child.
- Connects the finding to a real current focus, observed skill, interest,
  homeschool style, or saved `what_works` memory.
- Explains application without claiming that an activity caused progress.
- Never compares siblings or uses deficit framing.

### CTA

- Exactly one sentence and one action.
- Specific to the finding and child.
- The action must be available in the current cloud product:
  - design a quick game or activity in the reply;
  - create a printable through the materials studio;
  - set a reminder or scheduled task after collecting any missing timing
    details.
- Never promises calendar writes because cloud Homa does not currently have
  calendar-write access.
- Never uses a generic CTA such as “Want to know more?”
- A reply such as “Yes” resolves through the Conversation Continuity module to
  this exact offer.

## Saved-note link

The brief does not include `Saved it to` yet. The dedicated research-note
filesystem and route are being designed separately. When that surface exists,
the link can be added as a fifth block without changing the finding,
application, or CTA contract.

## Delivery and storage

- The same formatted text is sent by SMS or the email fallback.
- The exact text is stored in `homa_task_runs.summary` and displayed in Homa's
  tasks history with line breaks preserved.
- The whole message stays within the provider's 1,600-character SMS ceiling.
  If the draft is too long, Homa cuts detail rather than removing a required
  section.
- This format replaces the current freeform 2-to-4-sentence brief and its
  optional unlabeled offer.

## Producer

The root cause is the generated-copy producer, not the delivered artifact.
Implementation changes:

- `apps/web/agent/skills/research-brief/SKILL.md`: binding format, sentence
  limits, CTA capability rules, and no-link rule.
- `apps/web/agent/schedules/dispatch.ts`: the morning-brief dispatch prompt
  explicitly requires the skill's four-block output and names the no-preamble
  contract.

No UI layout or database migration is required.

## Verification

1. A deterministic format-contract unit test checks all four blocks, order,
   blank lines, sentence ceilings, one CTA question, and the 1,600-character
   cap.
2. A prompt/model eval checks that Homa produces the approved shape from a
   representative knowledge row and Story fixture context.
3. A negative fixture rejects:
   - missing labels;
   - more than two sentences in either body section;
   - a calendar-write promise;
   - a saved-note link;
   - multiple CTA questions;
   - internal ids or score terms.
4. Typecheck, source lint, production build, Eve build, event guard, and the
   existing conversation-continuity suite remain green.

## Out of scope

- Building the dedicated research-note filesystem or route.
- Adding calendar tools.
- Changing fleet research selection, knowledge-bank storage, schedule cadence,
  or SMS/email delivery mechanics.
- Reformatting evening journal prompts or parent-created tasks.
