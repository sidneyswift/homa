# Morning research brief format design

> Status: superseded in part by
> `2026-07-16-morning-research-brief-v2-design.md`. This historical format
> document records the original four-block decision. The microscope emoji,
> generic source-type rule, 600-character budget, routine recall, and direct
> observation-use instruction are no longer valid for v2.

## Goal

Make the cloud morning research text match the scannable Mac Mini format the
founder prefers: name the topic, separate the research finding from the
family-specific application, then offer one action Homa can perform.

## Exact output contract

```text
Last night I researched {topic}

What I learned: {1 to 2 sentences about the research itself.}

Why it's interesting: {1 to 2 sentences connecting the finding to this child.}

Want me to {one specific action Homa can complete}?
```

The labels and blank lines are required. The topic uses a plain parent-facing
name such as `phonics`, `self-regulation`, or `fine motor skills`. V2 also
requires the actual supplied source name, one exact child evidence anchor, one
action-shaping non-obvious detail, and a matching CTA.

The headline is always `Last night I researched {topic}`. Family dispatch
cannot search the web for corpus material or save to the fleet knowledge bank.
If no eligible candidate exists, Homa sends no brief. Nightly fleet research
handles that demand outside family context.

## Content rules

### What I learned

- One or two sentences.
- States the finding, not the child's progress.
- Uses only evidence present in the selected eligible knowledge-bank row.
- Names the actual supplied study, framework, or evidence source. A generic
  source type is not enough in v2.
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
- V2 keeps the whole message at or below 900 visible characters and ten actual
  carrier segments. The plain headline removes the required emoji, but the
  actual carrier calculation remains authoritative. If the draft is too long,
  Homa cuts supporting detail rather than removing a required section.
- This format replaces the current freeform 2-to-4-sentence brief and its
  optional unlabeled offer.

## Producer

The root cause is the generated-copy producer, not the delivered artifact.
Historical implementation changes:

- `apps/web/agent/skills/research-brief/SKILL.md`: binding format, sentence
  limits, CTA capability rules, and no-link rule.
- `apps/web/agent/schedules/dispatch.ts`: the morning-brief dispatch prompt
  explicitly requires the skill's four-block output and names the no-preamble
  contract.

V2 adds a prepared-draft service and delivery records. The model must call
`prepare_research_brief` successfully before exact final output. It uses
prefetched delivered traces rather than routine recall. No candidate means no
brief; family dispatch never searches or saves fleet knowledge. Nightly
fleet-research demand handles the missing corpus row. Delivery, not the skill,
marks an optional observation used.

## Verification

1. The deterministic transport validator checks the exact four-block shape,
   supported CTA syntax, 900 visible characters, and ten carrier segments.
2. A separate deterministic fixture evaluator consumes explicit sources,
   claims, child anchors, sibling names, recent traces, and CTA concepts. Each
   semantic negative must fail for its named reason.
3. Eve routing evals cover dispatch-positive, parent-chat adjacent-negative,
   and materials-request adjacent-negative behavior.
4. The optional paid craft-only eval uses a second model call as an
   evidence-grounded semantic judge. It does not test tool or preparation
   sequencing.

## Out of scope

- Building the dedicated research-note filesystem or route.
- Adding calendar tools.
- Changing fleet research selection, knowledge-bank storage, schedule cadence,
  or SMS/email delivery mechanics.
- Reformatting evening journal prompts or parent-created tasks.
