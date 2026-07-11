# Homa motion review reference

This is a compact reviewer reference, not an independent design authority.
Current Homa sources win in this order: repository instructions and founder
rulings, `docs/homa-design/readme.md`,
`docs/homa-design/tokens/motion.css`, then the two motion specimens under
`docs/homa-design/guidelines/`.

## Current tokens

Read the token file before citing a value. As of the current design source:

| Purpose | Token | Current value |
| --- | --- | --- |
| Entrances and responsive state changes | `--ease-out` | `cubic-bezier(0.22, 0.8, 0.28, 1)` |
| On-screen state movement | `--ease-in-out` | `cubic-bezier(0.5, 0, 0.2, 1)` |
| Hover and press feedback | `--dur-fast` | `120ms` |
| Base state changes | `--dur-base` | `200ms` |
| Entrances | `--dur-slow` | `320ms` |
| Press feedback | `--press-scale` | `0.98` |

Do not duplicate these values in production code when the shared token is
available. If the source tokens change, this table must change in the same
documentation reconciliation pass.

## Brand rules

- Product motion is gentle and quick.
- Product UI does not use bounce, spin, parallax, confetti, or infinite loops.
- The splash character's landing is the one documented bounce exception.
- Hover may darken a button or lift a card by 2px. Hover styling cannot be the
  only carrier of state or meaning.
- Press feedback uses the current press token.
- Standard entrances use a gentle rise with the current slow duration and
  ease-out token.

## Signature check-off

The current check-off specimen establishes a bounded exception with its own
timing:

- The circle fills sage and pops over 350ms.
- One gold star floats up over 800ms.
- The title quiets to a strike-through.
- The action is undoable and never opens a modal.
- Reduced motion uses an instant fill and no floating star.

Do not generalize its pop or star to other components without a new design
decision.

## Interaction review heuristics

These are engineering review questions, not additional brand laws:

- Does the motion explain state or confirm an action?
- Is it quieter for a frequently repeated action?
- Can a repeated or gesture-driven transition reverse from its current state?
- Does a trigger-anchored surface preserve the spatial connection to its
  trigger?
- Does removing movement preserve focus, state, and meaning?
- Is input available while the transition runs?

## Accessibility

Inspect `prefers-reduced-motion` behavior directly. The right reduced state is
surface-specific: remove nonessential movement, keep the final state visible,
and preserve any opacity or color change needed for comprehension. Test keyboard
focus and touch interaction separately from pointer hover.

## Performance

- Flag `transition: all`; name the intended properties.
- Prefer targeted `transform` and `opacity` transitions when they express the
  same visual result without layout work.
- Do not claim that a library, shorthand, or animation runs on or off the GPU
  without current profiling evidence.
- Do not claim a dropped-frame regression from code inspection alone. Capture a
  performance trace or a reproducible recording on a representative device.
- Choose CSS, the Web Animations API, or a JavaScript motion library according
  to the interaction's interruptibility and state needs. No tool is universally
  correct.

## Evidence language

Use `verified` only for behavior observed in the current implementation,
rendered evidence, test, or production probe. Use `prototype direction` for
UI-kit and template examples. Use `recommendation` for judgment that is not a
documented Homa rule.
