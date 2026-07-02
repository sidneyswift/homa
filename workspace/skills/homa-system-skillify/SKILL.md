---
name: homa-system-skillify
description: Turn whatever the parent or partner just worked through into a reusable skill in workspace/skills/. Use when they say "skillify this", "make this a skill", "save this as a skill", "turn this into a skill", or similar — Homa distills the recent work into a SKILL.md, writes it, then shows the result for feedback. This is how Homa grows: a workflow figured out once should never have to be re-explained.
---

# Skillify

Every workflow the parent and Homa figure out together is worth keeping. The first time is exploration; the second time should be a skill. When the parent says **"skillify this,"** she's telling Homa: *take what we just did and make it repeatable so neither of us has to think it through again.*

This is the meta-skill — the one that makes Homa compound over time.

## Trigger

The parent or partner says any of: "skillify this", "make this a skill", "save this as a skill", "turn this into a skill", "remember how to do this". "This" = the work in the current thread — the thing they were just doing.

## What gets skillified

The recent work in this session: the goal, the steps that actually worked, the commands run, the files created, the decisions made, and — most valuable — the gotchas hit along the way. Reconstruct it from the conversation context. If "this" is genuinely ambiguous (two unrelated things happened), ask one short question; otherwise infer the most recent substantial piece of work and state your interpretation when you report back.

## How to do it — build first, ask after

The partner's rule applies here: **don't propose a plan and wait for approval.** Build the skill, write it to disk, *then* show the parent what you made and invite tweaks. Output is what gets validated, not plans. (Same spirit as the `homa-capture-feedback` loop.)

1. **Reconstruct the workflow.** What was the goal? What was the trigger ("when would I do this again")? What were the actual steps — the real commands, paths, and tools that worked? What decisions or judgment calls mattered? What went wrong before it went right?

2. **Generalize.** Strip the one-off specifics (today's date, this exact number, this one file) down to the repeatable shape — but keep a concrete worked example so it's not abstract. "I logged the child's 15 reading minutes today" becomes "append a dated reading-log row," with the real command shown.

3. **Name it per the convention (RULE).** Every skill is `homa-<category>-<what>`, lowercase
   kebab-case, readable on sight — category ∈ {system, make, google, track, capture} (see the naming
   rule in AGENTS.md). E.g. a co-op handout filer → `homa-capture-coop-handouts`; a new printable →
   `homa-make-<thing>`. If no category fits, add one to the AGENTS.md rule first. The
   `homa-system-doctor` flags any skill that breaks the pattern or isn't listed in the Quick
   Reference. **First check `workspace/skills/` for an existing match — if one already covers this,
   UPDATE that file instead of creating a near-duplicate.**

4. **Write `~/.openclaw/workspace/skills/<name>/SKILL.md`** following the format below.

5. **Verify, don't invent.** Every command in the skill must be one that actually worked, or one you confirmed with `<tool> --help`. Never write a plausible-looking flag you didn't check — that's how the bogus `gog sheets create` got into TOOLS.md. gog commands take `-a {{PARENT_EMAIL}}`.

6. **Register it.** Add a one-line entry to the "🧩 Skills (Quick Reference)" list in `AGENTS.md` so it's documented and discoverable.

7. **Report to the parent.** One short message: the skill name, its one-line description, what it covers, and the file path. End with "want me to change anything?" — the feedback comes from seeing the real thing.

## The format every skill must follow

```
---
name: homa-<category>-<what>
description: <what it does, plus "Use when..." so it triggers at the right moment>
---

# <Title>

<Why this exists / when it matters — a sentence or two.>

## <The workflow — steps, real commands, concrete example>

## <Gotchas, rules, when NOT to use it>
```

Hard rules for any skill Homa writes:
- **Absolute paths** under `~/.openclaw/workspace/`.
- **Family guardrails baked in:** ask before destructive or outward-facing actions (sending, sharing, deleting), never spam, surface-and-ask rather than auto-act on calendar/email.
- **Cross-link** related skills by name.
- **Concise.** A skill is a cheat sheet, not an essay. Capture the gotchas, not every keystroke.

## When NOT to skillify

- **One-offs.** If the work won't recur, say so and skip it — don't litter `skills/` with junk that dilutes the real skills.
- **Duplicates.** If it overlaps an existing skill, fold it in there instead.
- **Too thin.** If there's no real workflow yet (just one command), it might belong in `TOOLS.md` as a note rather than a standalone skill. Use judgment.

## Meta

This skill was itself created by being skillified — Homa turning "here's how to make skills" into a skill. That's the loop working.
