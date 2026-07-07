---
version: alpha
name: Homa · Warm and Playful
description: Coral-primary, cream-paper design system for Homa, a calm AI homeschool assistant. Schoolbook charm held together by editorial restraint.
colors:
  primary: "#E7602F"
  secondary: "#3D9A50"
  tertiary: "#F0BE00"
  neutral: "#FBF7F0"
  surface: "#FFFFFF"
  "on-primary": "#FFFFFF"
  "on-surface": "#221E1A"
  info: "#4FB4D6"
  error: "#E2593B"
typography:
  display:
    fontFamily: Schibsted Grotesk
    fontSize: 3rem
    fontWeight: 700
    letterSpacing: -0.02em
  wordmark:
    fontFamily: Fredoka
    fontWeight: 600
  serif-accent:
    fontFamily: EB Garamond
    fontSize: 1.125rem
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 0.75rem
    letterSpacing: 0.06em
rounded:
  sm: 10px
  md: 16px
  lg: 22px
  full: 999px
spacing:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    padding: 12px
  button-primary-hover:
    backgroundColor: "#C44C22"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
---

## Overview

This file is a spec-compliant summary of Homa's design system for agents and tools that specifically read `DESIGN.md` (for example Google Stitch). **`docs/homa-design/` remains the single source of truth**, read `docs/homa-design/SKILL.md` first for the full quick reference, tokens, and components. If the tokens in `docs/homa-design/tokens/` change, update this file's front matter to match, the same rule that applies to `apps/web`'s hand-copied tokens (see `AGENTS.md`).

Homa is a calm, capable AI co-pilot for homeschooling moms. Direction: **"Warm and playful"**, the schoolbook charm of a children's museum held together by editorial restraint. Cream paper (sometimes ruled like a notebook), a coral primary with mint, sunshine, and pool-aqua friends, clean modern headlines with a clay accent word, the little-home character mark beside the bounced "Homa" wordmark, chunky pill buttons, blob-masked photos, squiggle dividers. Rule of restraint: one or two playful devices per surface, never all of them at once. The promise, said everywhere: **"You've got this. Homa's got the rest."** Every surface should express one feeling, calm, and one relationship, a companion in your corner.

## Colors

- **Primary · clay/coral (`#E7602F`):** the one driver for interaction (buttons, links, focus).
- **Secondary · sage/mint (`#3D9A50`):** growth, progress, "on track" states. Never paired with red for contrast, Homa has no "behind" state (anti-guilt display law).
- **Tertiary · gold/sunshine (`#F0BE00`):** accent, celebration, checkmark/gold-star progress language. Text on gold tints always uses the dedicated `gold-ink` token, never plain dark or white.
- **Neutral · warm cream (`#FBF7F0`):** the page background, never pure white or gray, everything is warm-toned including neutrals (a "stone" scale, not a gray scale).
- **Info · sky/pool aqua (`#4FB4D6`):** a fourth accent for informational moments, distinct from the sage/gold/clay trio.
- **Error · warm coral-red (`#E2593B`):** used sparingly and never for "behind" or comparison framing, only for real errors (a broken form field, a failed request).

Full scales (50–900 steps per color, dark theme remap, section bands, pop accents) live in `docs/homa-design/tokens/colors.css`.

## Typography

- **Display (Schibsted Grotesk):** headlines, big numbers, dialog titles. 700 at hero scale, 600 for mid titles, tracked -0.015em.
- **Wordmark (Fredoka):** the bounced "Homa" lockup only, never running text or headlines.
- **Serif accent (EB Garamond):** italics inside a headline, taglines, and pull quotes only.
- **Body/UI (Hanken Grotesk):** everything else, the humanist sans workhorse.
- **Hand (Caveat):** Homa's handwriting, product margin notes, always sage, one per surface, max.
- **Mono (JetBrains Mono):** data and numeric readouts.

Keep it to two voices per screen plus body. Full type scale (sizes, line heights, weights, tracking) in `docs/homa-design/tokens/typography.css`.

## Layout & Spacing

4px base scale, generous and airy (`--space-1` through `--space-24`, 4px to 96px). Container widths: 640/820/1100/1280px (sm/md/lg/xl). Full scale in `docs/homa-design/tokens/spacing.css`.

## Elevation & Depth

Shadows are soft and warm-tinted (brown, not gray), low spread, diffuse, five steps (`xs` through `xl`) plus a dedicated focus glow and an inset for pressed/sunken fields. Full values in `docs/homa-design/tokens/shadows.css`.

## Shapes

Corners are soft and rounded, never sharp: `sm` 10px, `md` 16px, `lg` 22px (the card radius), up to `2xl` 40px, and a `pill` (999px) for buttons. Playful devices layer on top, organic blob masks for photos, a ruled-notebook paper background, and an ink squiggle divider, used one or two per surface, never all at once. Full tokens in `docs/homa-design/tokens/radius.css` and `docs/homa-design/tokens/shapes.css`.

## Components

- **Button:** pill-shaped (`rounded.full`), warm clay primary, variants `primary | secondary | soft | ghost | danger`, sizes `sm | md | lg`. Never ship a square or sharp-cornered button.
- **Card:** white surface, `rounded.lg` corners, soft shadow.

Full component catalog (Badge, Callout, Chip, Skeleton, EmptyState, Doodle, Squiggle, navigation, and more) with props and usage in `docs/homa-design/components/`.

## Do's and Don'ts

- **Do** write "Homa" in title case everywhere in prose; reserve all-caps "HOMA" for UI-surface wordmark treatments only.
- **Do** lead with growth, effort, and "on track" framing on any dashboard or report.
- **Don't** use an em dash, anywhere, ever, use a comma, period, colon, or mid-dot instead.
- **Don't** show a red "behind" label or compare siblings, this is a hard anti-guilt law, not a style preference.
- **Don't** fabricate social proof (family counts, testimonials) in any generated UI copy.
- **Don't** hand-edit `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, or `_adherence.oxlintrc.json`, they are generated.
