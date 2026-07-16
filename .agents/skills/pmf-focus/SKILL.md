---
name: pmf-focus
description: >-
  Ruthlessly focus work on product-market fit by finding the single most
  important limiting factor, fixing only that until it is done, then moving to
  the next. Dispatches a "WTF are you doing" subagent that challenges distraction,
  verifies assumptions against real data, and maintains a durable research log
  of limiting factors across the product surface. Use when the user asks for
  PMF focus, says they are scattered, wants the limiting factor, asks "what
  should I work on", wants a WTF-are-you-doing pass, needs to say no to
  non-PMF work, or wants to update or review the PMF limiting-factor log.
---

# PMF Focus

## Objective

The only objective is finding product-market fit. Everything else is noise until the current limiting factor is gone.

This skill does one thing: identify the single bottleneck that most limits PMF, prove it with reality (not vibes), drive it to completion, log the result, then find the next bottleneck. No parallel "important" work. No polishing. No roadmap tourism.

## Hard laws

1. **One limiting factor at a time.** If two things feel equally important, pick the one that, if fixed, most increases the chance a real user gets and keeps the core value.
2. **Incomplete current work blocks everything else.** Do not start the next factor, a "quick win," or a redesign until the current factor is marked `complete` with verified evidence.
3. **Assumptions are liabilities.** Every claim about users, funnel, retention, or product quality must be checked against real data, production evidence, or a live probe. If it cannot be verified, it is a hypothesis, not a reason to build.
4. **Say no by default.** Any request that does not attack the current limiting factor gets a short refusal and a pointer back to the log.
5. **The log is the memory.** Do not rely on chat history for what the limiting factor is or what was already researched. Read and write `.context/pmf-focus/limiting-factor-log.yaml`.

## Artifacts

| Path | Role |
|---|---|
| `.context/pmf-focus/limiting-factor-log.yaml` | Durable state: current factor, history, research notes, say-no queue |
| `.agents/skills/pmf-focus/assets/limiting-factor-log.template.yaml` | Bootstrap template if the log does not exist |
| `.agents/skills/pmf-focus/references/wtf-subagent.md` | Prompt and role for the WTF subagent |
| `.agents/skills/pmf-focus/references/reality-checks.md` | How to verify assumptions against Homa/production evidence |
| `.agents/skills/pmf-focus/references/log-schema.md` | Field meanings and status transitions |

Create the log from the template on first use. Never invent a completed factor. Never clear history.

## Workflow

Run these steps in order. Do not skip the WTF subagent.

### 1. Load state

1. If `.context/pmf-focus/limiting-factor-log.yaml` is missing, copy the template from `assets/limiting-factor-log.template.yaml` and fill `product`, `pmf_definition`, and `updated_at`.
2. Read the full log.
3. If `current.status` is `in_progress` or `blocked`, the only allowed work is finishing or unblocking that factor. Skip to step 4 (execute), unless the user explicitly asks to re-evaluate because evidence changed.

### 2. Dispatch the WTF subagent

Launch a `generalPurpose` Task subagent (or equivalent) with `run_in_background: false`.

Read `references/wtf-subagent.md` and use its prompt verbatim, filling in:
- Current log contents (or a faithful summary plus path)
- User's latest request
- Product context pointers (for Homa: `BUILD.md`, PRD, founder rulings, production evidence sources from `references/reality-checks.md`)

The subagent's job is not to be nice. Its job is to name **one** limiting factor, kill competing work, and demand evidence.

### 3. Verify and lock the factor

From the subagent output:

1. Treat the proposed factor as a candidate only.
2. Run the reality checks in `references/reality-checks.md` that apply. Prefer production probes, real family/user evidence, funnel or retention numbers, and live behavior over docs or opinions.
3. If evidence overturns the candidate, send the subagent a short correction with the new evidence and get a revised single factor. Do not invent a compromise list of three priorities.
4. Write the locked factor into the log as `current` with status `identified` then immediately `in_progress` once work starts. Record evidence citations under `research_notes`.

### 4. Execute only that factor

- Plan the smallest path that removes the bottleneck.
- Implement or drive the fix to a verifiable done state.
- Refuse or park anything else in `say_no_queue` with a one-line reason.
- If blocked on founder decision or missing access, set status `blocked`, write the blocker plainly, and stop. Do not start adjacent work to "stay productive."

### 5. Complete, then advance

A factor is `complete` only when:

- The success criteria written in the log are met, and
- Verification evidence is recorded (what was checked, where, result).

Then:

1. Move `current` into `history` with `completed_at` and evidence.
2. Clear `current` or set it to null.
3. Dispatch the WTF subagent again for the **next** limiting factor (step 2). Do not guess the next factor without the subagent + reality checks.

## Modes

| User ask | Behavior |
|---|---|
| "What should I work on?" / "PMF focus" | Full workflow from step 1 |
| "WTF am I doing?" / "challenge this plan" | Step 2–3 only; update log if the factor changes |
| "Update the log" / "mark this done" | Verify completion evidence, then step 5 |
| "Should I do X?" | Compare X to `current`. If not the factor: say no, append `say_no_queue` |
| Mid-fix on current factor | Stay in step 4. Do not re-prioritize unless evidence collapsed |

## Parent agent behavior

- Announce: "Using pmf-focus to find and attack the PMF limiting factor."
- Always read the log before advising priorities.
- Always call the WTF subagent for identification or re-identification. The parent does not silently nominate the factor alone.
- Keep replies short and blunt when saying no. Point at the current factor and the log path.
- After any status change, write the log in the same turn.

## Anti-patterns

- Ranking a top-5 list and calling that focus
- "While we're here" fixes adjacent to the factor
- Treating a plan doc or backlog item as evidence
- Marking complete because the code merged without a user/production check
- Starting research theater across the whole product instead of evidence for the candidate bottleneck
- Keeping two `in_progress` factors
- For Homa: calling `sandbox = false` or `status = open` rows "real families" / "signups" (see `references/reality-checks.md` denominators: signup-screen abandon vs signed-up vs family setup done)

## Done looks like

Every session either:

1. Advances the current limiting factor with verified progress, or
2. Completes it with evidence and locks the next one, or
3. Says no to a distraction and leaves the log unchanged except `say_no_queue`.
