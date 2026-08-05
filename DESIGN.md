---
version: quiet-authority-v1
contractChecksum: a27c223c3d9a8deaff621493b4639cd2037b7194e3e3fb75c50cfebafdcbfda4
name: "Homa, quiet authority"
description: "A calm, capable, artifact-first design system for homeschooling families. Real work leads, Homa keeps the thread, and every meaningful moment ends with one useful next move."
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
    fontFamily: "EB Garamond"
    minimumFontSize: 20px
    role: "meaningful invitations, page titles, reflective framing"
  interface:
    fontFamily: "DM Sans"
    role: "UI, body, labels, data, and controls"
  wordmark:
    fontFamily: "Fredoka"
    role: "real Logo component only"
shape:
  control: 12px
  card: 18px
  frame: 28px
  pill: "compact-selections-only"
motion:
  sequence: "peek, orient, draw, land, still"
  duration: "120ms to 320ms per movement, under 900ms total"
  reducedMotion: "final-still-immediately"
channels:
  expressive: "web, native"
  staticRich: "marketing"
  constrained: "email, print, provider"
  plainText: "sms, metadata"
appearance:
  light: "approved-color-tokens"
  darkAdaptive: "projection-owned-adaptive-tokens"
  forcedColors: "system-colors"
  increasedContrast: "approved-color-tokens"
  grayscale: "approved-color-tokens-and-tones"
---

# Homa design system

This file is the compact machine-facing summary of the Quiet authority
contract. The canonical typed values live in `packages/design/src/contract`
and the human doctrine lives in `docs/homa-design/doctrine.md`, with the
longer visual guide in `docs/homa-design/readme.md`. Generated
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
roof thread, Homa presence, and rare campaign or editorial punctuation.
It is not the default filled button, and white text on coral is not an approved
normal-text pair. Green, blue, amber, and red are semantic states only.

The typed color composition owns the approved proportions. They are a
discipline, not a quota that overrides a truthful state.

## Type roles

EB Garamond is the display voice for meaningful invitations, page, section,
and card titles, and reflection. DM Sans is the interface and body voice,
including data and labels. Fredoka is allowed only inside the real Logo
component. There is no hand font in the active contract.

Use sentence case. Keep a readable measure, test long names and localization,
and preserve the display voice when a line wraps. Exact sizes, line heights,
weights, tracking, and metric behavior live only in the typed role catalog.

## Shape, depth, and density

Controls, cards, and large frames use distinct contract-owned corner roles.
Pills are a specific compact treatment, not the default geometry. Keep depth
restrained and avoid nested bordered cards. A fine warm rule often carries
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
and the contract-owned zoom and reflow profiles. Native surfaces prove
VoiceOver, Dynamic Type, safe areas, keyboard, Reduce Motion, and appearance. PDFs and
physical print use their own evidence floors. Source inspection is not proof of
rendered or delivered behavior.

## Copy

Write Homa, never HOMA. Use clear, memorable, kind language. Never use an
em dash. Never use red or behind framing for a child. Never compare siblings.
Say the real thing, offer one useful next move, and leave the parent in charge.
