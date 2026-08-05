# Homa, quiet authority

This is the active human guide for the Homa brand system. It supersedes the
former visual direction. The implementation contract is generated
from `packages/design/src/contract`; this guide explains how to use it across
web, native, landing, email, SMS, reports, print, stores, social, providers,
and authoring systems.

The normative cross-surface doctrine is [`doctrine.md`](doctrine.md). This
guide provides the longer visual reference; the typed contract remains the
authority for exact values and allowed combinations.

## The feeling

Homa is calm, capable, and observant. She notices the real work, keeps the
thread, and makes the next step easier. The experience should feel like a
trusted guide at the kitchen table, not a gradebook, toy, or generic premium
SaaS dashboard.

The signature sentence is: real work, one warm guide, one useful next move.
Use it as a composition rule, not as copy that must appear verbatim everywhere.

## Visual contract

### Palette

| Role | Use |
| --- | --- |
| Mineral canvas | Default page and quiet bands |
| Ink | Primary text and structure |
| Paper | Reading surfaces and artifacts |
| Floating | Temporary elevated surfaces only |
| Visual coral | Homa, roof thread, visual signature, and rare campaign or editorial punctuation |
| Midnight action | Filled action, selected state, structural emphasis |
| Brand text | Accessible coral-family text substitute |
| Control boundary | Borders and quiet controls |
| Constructive ink/tint | Truthful constructive state |
| Info ink/tint | Truthful information state |
| Highlight ink/tint | Attention or celebration, never a score |
| Error ink/tint | Real system failure only |

Color carries meaning. Semantic colors do not decorate and do not describe a
child's worth. Coral is a small recognizable signal, not a universal action
color. White on coral is reserved for large display treatment only, never
normal control text.

### Typography

- EB Garamond, display. Use for page, section, and card titles, meaningful
  invitations, and reflection.
- DM Sans, interface and body. Use for controls, labels, body copy, data,
  navigation, and reports that need dense reading.
- Fredoka, real Logo component only. Never type a substitute wordmark and
  never use Fredoka as a UI voice.

Exact sizes, line heights, weights, tracking, and metric behavior live in the
typed role catalog. Test long names, localization, font failure, Dynamic Type,
and PDF embedding.

Font provenance and fallbacks live in the typed registry at
`packages/design/src/contract/fonts.ts` and its generated projection at
`packages/design/generated/fonts.json`. The registry records the SIL Open Font
License source, checked-in specimen hashes, runtime loaders, and a declared
fallback for every channel. The evidence file at
`docs/homa-design/evidence/font-system.json` is a contract check, not a claim
that rendered loading, layout stability, native accessibility, or PDF
embedding has already passed.

### Geometry

Controls, cards, and large frames use distinct contract-owned corner roles.
Use the shared spacing rhythm, clear grouping, and restrained elevation. Do not stack a bordered card
inside another bordered card unless the inner object is genuinely interactive.
Pills are for compact selections, not every button. Fine rules, mineral space,
and an editorial grid should do most of the visual work.

### Identity

The real Logo is the only Homa mark. Its master geometry is owned by
`packages/design/src/contract/brand.ts` and projected into web, native, print,
and constrained channels. No route, renderer, email, or asset generator may
redraw the house, eyes, roof, wordmark, or character from local primitives.

The roof-derived coral thread is optional but meaningful. It starts at a real
learning object, stays restrained, avoids faces, text, and controls, and lands
at the useful next move. Its exact path, stroke, caps, and turn limits live in
the typed identity contract. It never loops for decoration.

Imagery is artifact-first: natural light, family-height camera, lived-in work,
privacy-safe details, and a crop that leaves room for the next move. Do not
use staged stock imagery as the universal identity proof.

## Motion language

Homa uses `peek → orient → draw → land → still`. A truthful live state may
orient the character toward the real object, draw the thread, and settle.
Reduced Motion goes directly to the final still. Motion must be interruptible,
must expire when its truth source expires, and must end in the current state.

## Surface grammar

### Product and native

Lead with the actual object or task. Use Homa at the edge, with a clear next
move and calm state language. Voice has a safe lane and never competes with the
primary task. Native adds Dynamic Type, safe areas, keyboard, haptics that tell
the truth, Reduce Motion, and appearance evidence.

### Landing, content, store, and social

Use a large real artifact or family detail, a restrained Homa guide, the coral
thread when it explains a relationship, and one useful action. Store and social
reduce to a legible mark, a single idea, accessible text, and a safe crop.

### Email, SMS, providers, reports, and print

Keep the content and next move. Email uses safe fallbacks, plain text, image-off
and dark-client states. SMS uses plain language and no visual promise. Reports
and print put the family artifact first and preserve reading order, provenance,
and truthful authorship. Provider surfaces inherit meaning and may not invent
independent colors, fonts, or geometry.

## Copy and care

Homa suggests, the parent decides. Use sentence case and say the real thing in
kind language. Never compare siblings. Never describe a child as behind. Never
turn a semantic error state into a judgment. Never fabricate social proof. Never
use an em dash.

## Evidence law

The manifest in `docs/homa-design/evidence/surfaces.json` is generated and
fail-closed. `legacy-baseline.json` is hash-specific comparison evidence only.
No screenshot, source grep, or critic claim substitutes for an installed,
delivered, rendered, or production probe. A row is not accepted until its
owned-input fingerprint, fixture, harness, client/runtime, evidence, and
rollback boundary are fresh.
