---
name: homa-design
description: Use when building or styling any Homa-branded interface, page, component, or asset in this project (apps/web, prototypes, mocks, social/marketing artifacts), or when writing Homa product/marketing copy. Homa is the AI homeschooling assistant this project builds. Covers the Quiet authority contract, fonts, the real Logo mark, semantic primitives, motion, channel profiles, and voice/copy rules.
---

# Homa Design System

The normative human doctrine lives in `docs/homa-design/`; exact values and
allowed combinations live in `packages/design/src/contract/`. Read
`docs/homa-design/SKILL.md` first for the workflow, then
`docs/homa-design/doctrine.md` for cross-surface rules and
`docs/homa-design/readme.md` for the full guide. Generated projections are
checked by `pnpm check:design-parity` and `pnpm check:design-authoring`.

Do not edit generated projections by hand. Run the contract and brand
generators, then use their check modes in CI.

## Project-specific notes

- `docs/homa-design/doctrine.md` is the normative human doctrine, `docs/homa-design/readme.md` is the longer visual guide, `packages/design/src/contract/` is the typed authority, `packages/design/generated/` is generated projection, and `DESIGN.md` is the compact tooling summary. If one changes, run the parity and authoring checks before calling the rail current.
- The real Logo component owns Homa's mark and wordmark. Do not redraw the house, eyes, roof, character, or thread in a route, prompt, email, print renderer, or asset generator.
- Hard copy rules from the repository instructions and `docs/homa-design/readme.md`: never use an em dash, write "Homa" in prose, and keep semantic colors truthful rather than decorative.
