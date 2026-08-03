# Homa, quiet authority

This is the active human guide for the Homa brand system. It supersedes the
former visual direction. The implementation contract is generated
from `packages/design/src/contract`; this guide explains how to use it across
web, native, landing, email, SMS, reports, print, stores, social, providers,
and authoring systems.

## The feeling

Homa is calm, capable, and observant. She notices the real work, keeps the
thread, and makes the next step easier. The experience should feel like a
trusted guide at the kitchen table, not a gradebook, toy, or generic premium
SaaS dashboard.

The signature sentence is: real work, one warm guide, one useful next move.
Use it as a composition rule, not as copy that must appear verbatim everywhere.

## Visual contract

### Palette

| Role | Value | Use |
| --- | --- | --- |
| Mineral canvas | `#F7F4EE` | Default page and quiet bands |
| Ink | `#20242B` | Primary text and structure |
| Paper | `#FFFEFC` | Reading surfaces and artifacts |
| Floating | `#FFFFFF` | Temporary elevated surfaces only |
| Visual coral | `#E7602F` | Homa, roof thread, punctuation, visual signature |
| Midnight action | `#27374D` | Filled action, selected state, structural emphasis |
| Brand text | `#A33F22` | Accessible coral-family text substitute |
| Control boundary | `#918B83` | Borders and quiet controls |
| Constructive ink/tint | `#335C46` / `#E5EFE8` | Truthful constructive state |
| Info ink/tint | `#2F5968` / `#E4EFF2` | Truthful information state |
| Highlight ink/tint | `#76560F` / `#F7EBC7` | Attention or celebration, never a score |
| Error ink/tint | `#923F33` / `#F5E5E1` | Real system failure only |

Color carries meaning. Semantic colors do not decorate and do not describe a
child's worth. Coral is a small recognizable signal, not a universal action
color. White on coral is reserved for large display treatment only, never
normal control text.

### Typography

- EB Garamond, display, minimum 20px. Use for page titles, meaningful
  invitations, and reflection.
- DM Sans, interface and body. Use for controls, labels, body copy, data,
  navigation, and reports that need dense reading.
- Fredoka, real Logo component only. Never type a substitute wordmark and
  never use Fredoka as a UI voice.

The display role is 44/46 on phone and 64/66 on desktop for a hero, 32/36 to
40/44 for page titles, 26/31 to 32/37 for sections, 16/24 body, 18/28 large
body, 14/20 small body, 15/20 controls, 13/18 captions, and 12/16 eyebrows.
Metric figures stay in DM Sans with tabular figures. Test long names,
localization, font failure, Dynamic Type, and PDF embedding.

Font provenance and fallbacks live in the typed registry at
`packages/design/src/contract/fonts.ts` and its generated projection at
`packages/design/generated/fonts.json`. The registry records the SIL Open Font
License source, checked-in specimen hashes, runtime loaders, and a declared
fallback for every channel. The evidence file at
`docs/homa-design/evidence/font-system.json` is a contract check, not a claim
that rendered loading, layout stability, native accessibility, or PDF
embedding has already passed.

### Geometry

Controls are 12px, cards 18px, and large frames 28px. Use a 4px spacing base,
clear grouping, and at most two elevations. Do not stack a bordered card
inside another bordered card unless the inner object is genuinely interactive.
Pills are for compact selections, not every button. Fine rules, mineral space,
and an editorial grid should do most of the visual work.

### Identity

The real Logo is the only Homa mark. Its master geometry is owned by
`packages/design/src/contract/brand.ts` and projected into web, native, print,
and constrained channels. No route, renderer, email, or asset generator may
redraw the house, eyes, roof, wordmark, or character from local primitives.

The roof-derived coral thread is optional but meaningful. It starts at a real
learning object, makes no more than two turns, avoids faces, text, and controls,
and lands at the useful next move. It is 2px in product and 3px in brand
surfaces, with round caps. It never loops for decoration.

Imagery is artifact-first: natural light, family-height camera, lived-in work,
privacy-safe details, and a crop that leaves room for the next move. Do not
use staged stock imagery as the universal identity proof.

## Motion language

Homa uses `peek → orient → draw → land → still`. A truthful live state may
orient the character toward the real object, draw the thread, and settle. Each
movement is 120ms to 320ms and the whole sequence stays below 900ms. Reduced
Motion goes directly to the final still. Motion must be interruptible and its
end must match the underlying state.

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
