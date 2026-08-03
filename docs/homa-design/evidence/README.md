# Brand-system evidence

This directory is generated evidence for the Homa brand-system rollout. It is
not an alternative design authority. `packages/design` is the machine source,
and `docs/homa-design` explains the same contract for people and agents.

`surfaces.json` is generated from tracked sources and explicit external
providers. Run `pnpm build:brand-surfaces` after adding, deleting, or moving a
brand-bearing surface. CI runs `pnpm check:brand-surfaces` and rejects stale
or unclassified work. Rows use the approved manifest types, the three
criticality levels, the ten dispositions, and the five delivery states from
the implementation plan.

`legacy-baseline.json` is the hash-specific warm-playful baseline. It is a
quarantined comparison namespace, not an active allowlist. It is excluded from
product bundles, indexing, generators, and active design discovery.

`pnpm check:brand-residue` is the pull-request ratchet. It scans the delivery
delta and rejects newly introduced legacy identity. `pnpm audit:brand-residue`
scans the complete tracked text tree against the hash baseline. The audit is
intentionally allowed to fail while migration work remains: its findings are
the eradication queue, not a reason to add another baseline exemption. A final
release may not close until the audit passes from a clean checkout.

The manifest records Android as intentionally unreleased because the existing
cross-platform ruling reserves Android for a future build. That is a release
disposition, not permission for visual drift: Android shares the native
projection, must compile, and must fail closed before Google Play distribution.

Legacy screenshots and binaries do not belong in active bundles, indexes,
generators, or design discovery. Comparative evidence is identified by source
commit and content hashes. Git remains the recovery archive.

## Criticality

- Critical covers identity, access, billing, child evidence, delivery, legal,
  and any surface whose failure can harm trust.
- High covers direct family and public surfaces.
- Standard covers bounded supporting surfaces.
- Internal covers operator and authoring surfaces.

These tiers may strengthen evidence requirements. They may never weaken brand,
behavior, accessibility, residue, or production-acceptance gates.
