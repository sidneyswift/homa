---
version: quiet-authority-v1
contractChecksum: ca48745c8f5cfe7f65c6cab581edb1b412cfe3caa8bd078409f10e35d4401ee3
name: Homa, quiet authority
description: A calm, capable, artifact-first design system for homeschooling families. Real work leads, Homa keeps the thread, and every meaningful moment ends with one useful next move.
colors:
  canvas: "#F7F4EE"
  ink: "#20242B"
  paper: "#FFFEFC"
  floating: "#FFFFFF"
  visual-coral: "#E7602F"
  primary-action: "#27374D"
  brand-text: "#A33F22"
  control-boundary: "#918B83"
  constructive-ink: "#335C46"
  constructive-tint: "#E5EFE8"
  info-ink: "#2F5968"
  info-tint: "#E4EFF2"
  highlight-ink: "#76560F"
  highlight-tint: "#F7EBC7"
  error-ink: "#923F33"
  error-tint: "#F5E5E1"
typography:
  display:
    fontFamily: EB Garamond
    minimumFontSize: 20px
    role: meaningful invitations, page titles, and reflective framing
  interface:
    fontFamily: DM Sans
    role: UI, body, labels, data, and controls
  wordmark:
    fontFamily: Fredoka
    role: real Logo component only
shape:
  control: 12px
  card: 18px
  frame: 28px
  pill: prohibited as a default shape
motion:
  sequence: peek, orient, draw, land, still
  duration: 120ms to 320ms per movement, under 900ms total
  reducedMotion: final still immediately
---

# Homa design system

This file is the compact machine-facing summary of the Quiet authority
contract. The canonical typed values live in `packages/design/src/contract`
and the human guide lives in `docs/homa-design/readme.md`. Generated
projections must carry the contract version and source checksum.

## North star

Homa should feel like quiet authority: grown-up enough to trust, warm enough
to invite curiosity, and specific enough to help a family take the next step.
The governing composition is:

1. Show a real family detail or learning artifact.
2. Let Homa keep the thread without becoming the subject.
3. Offer one useful next move.

The object leads. Homa is a guide, not a mascot pasted over the work. A child
is never framed as a verdict, compared with a sibling, or described as behind.
Homa suggests, the parent decides, and every claim stays truthful.

## Color roles

Mineral canvas and paper carry most of the surface. Midnight owns functional
actions and selection. Coral is the memorable visual signature, used for the
roof thread, Homa presence, punctuation, and occasional large visual fields.
It is not the default filled button, and white text on coral is not an approved
normal-text pair. Green, blue, amber, and red are semantic states only.

Approved proportions are approximately 76 percent mineral or paper, 16
percent midnight structure, 6 percent coral signature, and 2 percent semantic
state color. The proportion is a discipline, not a quota that overrides a
truthful state.

## Type roles

EB Garamond is the display voice and never renders below 20px. Use it for
meaningful invitations, page titles, and reflection. DM Sans is the interface
and body voice, including data and labels. Fredoka is allowed only inside the
real Logo component. There is no hand font in the active contract.

Use sentence case. Keep a readable measure, test long names and localization,
and preserve the display voice when a line wraps. Approved web hero sizes are
44/46 on phone and 64/66 on desktop. Body is 16/24, large body 18/28, small
body 14/20, control 15/20, caption 13/18, and eyebrow 12/16.

## Shape, depth, and density

Controls use 12px corners, cards 18px, and large frames 28px. Pills are a
specific compact treatment, not the default geometry. Use at most two
elevations and avoid nested bordered cards. A fine warm rule often carries
more authority than another floating white panel.

## Motion

The Homa choreography is `peek → orient → draw → land → still`. Motion begins
only when the underlying state is truthful, can be interrupted, and settles
quickly. Loops belong only to a live state. Reduced Motion renders the final
oriented still immediately, with no simulated delay.

## Signature and channel reductions

The full product signature is one real artifact, one small Homa presence, one
roof-derived coral thread, and one useful next move. Static-rich channels keep
the artifact, Logo, thread, and next move. Constrained channels keep the Logo,
accessible colors, plain language, and next move. A provider cannot invent a
second Homa.

## Accessibility and evidence

Every applicable interactive state proves keyboard focus, pressed, disabled,
loading, error, success, forced colors, increased contrast, Reduced Motion,
200 percent zoom, and 400 percent reflow. Native surfaces prove VoiceOver,
Dynamic Type, safe areas, keyboard, Reduce Motion, and appearance. PDFs and
physical print use their own evidence floors. Source inspection is not proof of
rendered or delivered behavior.

## Copy

Write Homa, never HOMA. Use clear, memorable, kind language. Never use an
em dash. Never use red or behind framing for a child. Never compare siblings.
Say the real thing, offer one useful next move, and leave the parent in charge.
