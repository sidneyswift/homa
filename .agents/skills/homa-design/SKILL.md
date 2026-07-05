---
name: homa-design
description: Use when building or styling any Homa-branded interface, page, component, or asset in this project (apps/web, prototypes, mocks, social/marketing artifacts), or when writing Homa product/marketing copy. Homa is the AI homeschooling assistant this project builds. Covers brand tokens (colors, type, radii, shadows), fonts, the logo mark, UI kit components, voice/copy rules, and social/landing templates.
---

# Homa Design System

The design system's source of truth lives at `docs/homa-design/` (kept there, not inside this skill folder, so it stays browsable as project documentation and stays a single copy). Read `docs/homa-design/SKILL.md` first for the quick reference (fonts, colors, components, voice, dark theme), then `docs/homa-design/readme.md` for the full guide. Explore `docs/homa-design/{tokens,components,guidelines,social,templates,ui_kits}/` as needed.

Do not edit `docs/homa-design/_ds_bundle.js`, `_ds_manifest.json`, or `_adherence.oxlintrc.json`, they are generated.

## Project-specific notes

- `apps/web` hand-copies tokens, fonts, and the `Logo` component into `app/globals.css`, `app/layout.tsx`, and `components/brand/Logo.tsx` (temporary, until the `packages/design` workspace package lands per ticket M1-17). If you change anything in `docs/homa-design/`, check whether those files need the same update so they don't silently drift out of sync.
- The repo root also has a `DESIGN.md`, a spec-compliant (`google-labs-code/design.md` format) token summary for design tooling that reads that exact filename. It is derived from `docs/homa-design/tokens/`, update its front matter too when tokens change.
- Hard copy rules from `docs/homa-design/CLAUDE.md`: never use an em dash (use a comma, period, colon, or mid-dot instead), and always write "Homa" in title case, never all-caps "HOMA".
