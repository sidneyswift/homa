# Quiet authority doctrine

This is Homa's active cross-surface design doctrine. It explains the intent
behind the typed contract. Exact values, names, and allowed combinations live
in `packages/design/src/contract`; generated projections live in
`packages/design/generated`; `DESIGN.md` is the compact tooling summary.

## Authority

Homa is calm, capable, observant, and warm. She notices the real work, keeps
the thread, and makes one useful next move easier. The family artifact or task
leads the composition. Homa is a guide at the edge, never a mascot pasted over
the work. The parent decides.

The signature composition is:

1. Show the real work or a privacy-safe detail of it.
2. Let Homa connect that work to its context.
3. End with one useful next move.

This is a composition rule, not a slogan that should be repeated on every
surface.

## Visual atoms

Use the typed contract instead of inventing local values.

| Domain | Quiet authority rule | Typed source |
| --- | --- | --- |
| Color | Mineral canvas and paper carry the surface. Midnight owns functional action and selection. Coral is a small visual signature. Green, blue, amber, and red are truthful semantic states. | `colors.ts` |
| Typography | EB Garamond is display at 20px or larger. DM Sans is interface, body, labels, and data. Fredoka is restricted to the real Logo component. | `typography.ts` |
| Geometry | Controls are 12px, cards 18px, frames 28px, and spacing follows a 4px base. Pills are compact selection treatments, not default buttons. | `layout.ts` |
| Depth | Use no more than two elevation levels. Fine rules and mineral space usually carry more authority than another floating panel. | `layout.ts` |
| Identity | Use the real Logo adapter. The roof-derived coral thread starts at meaningful work, makes no more than two turns, avoids faces, text, and controls, and lands at the next move. | `brand.ts` |
| Motion | Use `peek → orient → draw → land → still` only when the underlying state is true. Interruptible motion settles under 900ms and Reduced Motion reaches the final still immediately. | `motion.ts` |
| Icons | Name the semantic role first, then resolve it through the platform registry. Functional icons are not character art. Unknown roles fail closed. | `icons.ts` |

Coral is not a universal action color. White on coral is reserved for large
display treatment, never normal control text. Semantic colors never describe a
child's worth or act as decoration.

## Channel reductions

A channel is a delivery constraint, not a second brand. Every projection uses
one of the typed channel profiles in `channels.ts`.

| Channel | Expression | Preserve | Reduction |
| --- | --- | --- | --- |
| Web product | Full expressive | Artifact, Logo, meaningful thread, next move | Truthful, interruptible motion and tested appearance modes |
| Native product | Full expressive | Artifact, Logo, meaningful thread, next move | Add Dynamic Type, safe areas, keyboard, haptics, and platform appearance evidence |
| Landing and marketing | Static rich | Artifact, Logo, meaningful thread, next move | Motion resolves to a still composition and remains legible in grayscale |
| Email | Constrained | Logo, plain-language next move | Safe fallbacks, image-off reading order, and client-controlled appearance |
| SMS | Plain text | Plain-language next move | No visual promise, no decorative status, no motion |
| Reports and print | Constrained | Artifact, provenance, plain-language next move | Embedded or declared fonts, reading order, grayscale proof, and honest authorship |
| Providers | Constrained | Approved static meaning and next move | Provider-safe fallbacks. A provider cannot invent a second Homa |
| Metadata and store text | Plain text | Plain-language next move | Legible text and tiny static mark only |

The channel contract does not claim external delivery. Email client, provider,
store, physical print, and social proof remain evidence gates owned by their
surface issues.

## Appearance and accessibility

Light mode is the default token projection. Dark adaptive mode is permitted
only when the projection owns tested adaptive tokens. Forced colors and
increased contrast preserve focus, boundaries, state semantics, and reading
order through system colors. Grayscale is a proof mode for print and static
assets, not permission to remove meaning.

Every appearance mode carries an evidence requirement in the typed contract.
Do not add an appearance mode because a client supports it. Add the mode to
the contract, define the fallback and contrast floor, then prove the rendered
surface. Web and native also prove keyboard or VoiceOver focus, large text,
200 percent zoom, 400 percent reflow, Reduced Motion, and interruption states
where applicable.

## Content and care

Content follows the same composition: real detail, kept thread, useful next
move. Use sentence case and the current true, clear, memorable, kind voice.
Homa suggests and the parent decides. Say the real thing without turning an
error into a verdict. Never compare siblings, describe a child as behind, or
use an em dash. Routine controls stay plain so the signature cadence remains
special when it is earned.

Use the content contract for brand casing, child framing, relationship language,
and constrained fallbacks. The verbal role matrix and format-specific copy
evidence are maintained by the verbal identity workstream, and must consume
this doctrine rather than introduce a parallel voice.

## Source and change law

1. Read this doctrine and `docs/homa-design/SKILL.md` before changing a branded
   surface.
2. Change the typed contract first when an exact value or allowed combination
   changes.
3. Run `pnpm build:design-contract`, then `pnpm check:design-contract` and
   `pnpm check:design-parity`.
4. Regenerate the brand-surface manifest and authoring evidence when sources
   or projections change.
5. Prove the relevant state and channel evidence. A source grep or screenshot
   is not proof of installation, delivery, or production behavior.
6. Remove migrated active dependencies in the same surface change, or record a
   path-and-hash exception with an owner, reason, and expiry.

Retired visual language may remain only in immutable historical evidence or a
negative test that proves it cannot enter the active contract. It is not an
authoring suggestion, fallback, or example.
