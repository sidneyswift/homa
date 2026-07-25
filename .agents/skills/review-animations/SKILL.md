---
name: review-animations
description: Reviews Homa animation and motion code against the current Homa design system, interaction context, accessibility requirements, and rendered evidence. Use for motion-specific review, not general UI review or implementation.
disable-model-invocation: true
---

# Reviewing Homa motion

Review animation and motion code without changing files. This skill is for a
motion-specific review. It does not implement features, fix unrelated code, or
substitute for `homa-uxui-reviewer` on the rendered interface.

## Authority

Use sources in this order:

1. Repository `AGENTS.md`, `BUILD.md`, and explicit founder rulings.
2. `docs/homa-design/readme.md`, especially its Motion section.
3. `docs/homa-design/tokens/motion.css` for exact easing, duration, and press
   tokens.
4. `docs/homa-design/guidelines/brand-motion.card.html` and
   `docs/homa-design/guidelines/motion-check-off.card.html` for the two current
   motion specimens.
5. The implementation, tests, and rendered evidence under review.
6. The secondary review heuristics in [STANDARDS.md](STANDARDS.md), only where
   they do not conflict with sources above.

The retired `emil-design-eng` skill was deleted 2026-07-24; its generic
motion guidance was never Homa authority and lives on only in git history.
UI-kit and template motion is prototype evidence unless a current route or test
establishes that the same behavior ships.

## Evidence to request

Review the diff and the smallest useful rendered evidence: a recording or frame
sequence, the trigger, the viewport or device, and the reduced-motion behavior.
Ask for missing evidence when a conclusion depends on feel, timing, or shipped
behavior. Do not infer production behavior from repository presence.

## Homa motion checks

Every finding must tie to a current source or to clearly labeled engineering
judgment.

1. **Purpose and frequency.** Motion should orient, explain a state change, or
   confirm an action. Frequent actions should be quieter and faster than rare
   moments. Decorative motion must not delay the task.
2. **Brand character.** Homa UI motion is gentle and quick. Bounce, spin,
   parallax, confetti, and infinite loops do not belong in product UI. The
   animated splash landing is the one documented bounce exception.
3. **Current tokens.** Prefer `--ease-out`, `--dur-fast`, `--dur-base`,
   `--dur-slow`, and `--press-scale` rather than new local values. Current
   values live in `docs/homa-design/tokens/motion.css`, never copy them from a
   historical skill.
4. **Documented patterns.** Button hover darkens, card hover may lift 2px, and
   press feedback uses the current press token. Entrances are gentle rises.
   The check-off interaction is undoable, uses no modal or confetti, and has a
   reduced-motion state with instant fill and no floating star.
5. **Accessibility.** Movement must honor `prefers-reduced-motion`. Hover-only
   effects must not be the sole carrier of meaning and should be limited to
   hover-capable pointers. Focus visibility and interaction state must remain
   clear when motion is removed.
6. **Interruptibility.** Repeated or gesture-driven transitions should retarget
   cleanly from their current state. Motion must not block input while it
   finishes.
7. **Performance.** Flag `transition: all`, avoid unnecessary layout work, and
   prefer targeted properties. Treat performance claims as evidence questions,
   not universal rules. Require a profile or reproduction before claiming a
   dropped-frame regression.
8. **Origin and continuity.** Trigger-anchored elements should appear connected
   to their trigger. State changes should preserve orientation. Modals remain
   centered unless the current component contract says otherwise.
9. **Production truth.** A prototype demonstrates a direction, not a shipped
   capability. Findings about production must cite a current route, test,
   deployment, or recording from the production surface.

## Required output

Return two parts.

### Findings

Use one markdown table, highest impact first. Cite `file:line` and name the
governing source. Separate verified facts from recommendations.

| Current | Recommended | Why | Evidence |
| --- | --- | --- | --- |
| `transition: all` | Name the properties that should transition | Prevents unrelated state changes from animating | `file:line`; Homa motion specimen |

If there are no findings, write `No motion findings.` and list the evidence
reviewed.

### Verdict

Choose one:

- **Block:** a current Homa rule, accessibility requirement, or verified
  interaction or performance requirement is violated.
- **Approve with notes:** no blocking issue remains, but a non-blocking polish
  or evidence gap should be tracked.
- **Approve:** the motion follows current Homa authority and the relevant
  rendered states were verified.

Do not approve a feel-dependent change from code alone. Name any missing device,
reduced-motion, or production evidence explicitly.
