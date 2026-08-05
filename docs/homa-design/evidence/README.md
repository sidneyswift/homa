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

Pull requests that change generated brand evidence must land with a merge
commit, never squash or rebase merge. Source rows bind the exact authored
commit lineage, which cannot name a future squash commit. A two-parent checkout
may use its second parent only when the complete Git tree is byte-identical;
any tree difference stays stale and requires rebase plus regeneration. Main CI
therefore fails closed if the wrong merge mode rewrites that provenance.

The `brand-inventory-v1` completeness guard is part of
`pnpm check:brand-surfaces`. It fails closed when authoring, artifacts,
providers, admin, marketing, native, or external-channel coverage disappears,
when a row loses its owner or required type, when a trust-critical path is
under-classified, or when an external provider or durable row has an invalid
delivery state. It validates the committed inventory only and never promotes
a row beyond its recorded rollout state or supplies production evidence.

`legacy-baseline.json` is the hash-specific warm-playful baseline. It is a
quarantined comparison namespace, not an active allowlist. It is excluded from
product bundles, indexing, generators, and active design discovery.

`legacy-removal.json` is the generated, fail-closed removal ledger owned by
gh#729. Each row retains its original detection hash and signatures while also
binding the current stable surface ID, path, source hash, signatures, owner,
disposition, and rollback boundary. New detections and any binding drift reset
to `open`; changed or deleted bytes never promote themselves. An explicit
resolution must use `replacement-verified`, `stop-generation-verified`,
`deleted`, or `immutable-residual` and supply the status-specific evidence,
rollback rehearsal, commit, production readback, or stop-generation receipt
required by the typed contract.

Run `pnpm build:legacy-removal` after the surface manifest changes. `pnpm
audit:legacy-removal` validates the ledger and reports the remaining queue
without failing solely because work remains. Final gh#729 certification uses
`pnpm audit:legacy-removal:strict`, which fails until the queue is empty.
`pnpm audit:brand-eradication` combines that ledger with a full active-tree
residue scan and reports the honest migration queue without claiming release
readiness. Final certification uses `pnpm audit:brand-eradication:strict`.

`pnpm check:brand-residue` is the pull-request ratchet. It scans the delivery
delta and rejects newly introduced legacy identity. `pnpm audit:brand-residue`
scans the complete tracked text tree against the hash baseline. The audit is
intentionally allowed to fail while migration work remains: its findings are
the eradication queue, not a reason to add another baseline exemption. A final
release may not close until the audit passes from a clean checkout.

`authoring-rails.json` is generated from the exact tracked authoring sources.
`pnpm check:design-authoring` requires every `.agents/skills/`,
`apps/web/agent/`, marketing voice and evaluator, design guide, and typed
contract source to have an exact manifest row, named consumer, current source
fingerprint, Quiet authority contract version, and no temporary migration
exemption. It also checks that the brand asset generator names contract roles,
that all generated asset rows are fingerprinted, and that authored residue is
zero. The one negative contract sentinel is recorded as an approved profile
rule, not a legacy allowlist.

`marketing-production.json` is the production-specific companion to
`surfaces.json`. `pnpm check:marketing-production` records every marketing
voice rule, asset, campaign, queue, bundle file, evaluator, and publishing
generator with a source hash and lifecycle state. It also records bundle
grounding, per-format approval and refusal, scorecard status, distribution
URLs, the channel reduction ladder, and named publisher blockers. Postiz,
Resend, and generation providers remain explicit fail-closed records until a
founder-owned readback exists. A quarantined historical asset or negative
fixture stays visible for forensics but cannot be treated as active output.

`channel-evidence.json` is the deterministic delivery contract for the five
non-web channel bundles owned by gh#728: email, parent-facing PDF, physical
print, hosted providers, and distribution assets. It records the exact
surface-coverage fingerprint, synthetic fixture checksum, design contract,
harness, and every profile hard gate. The initial rows are deliberately
`pending`: a synthetic fixture proves the schema without pretending that an
Apple Mail render, tagged PDF, physical print, provider read-back, or public
distribution receipt exists. `pnpm check:channel-evidence` fails when a
manifest or fixture changes, when a profile disappears, when a passing gate
lacks a retained proof path, or when a provider capability is simulated.

Every passing receipt uses schema v2 and binds the exact profile-scoped input
fingerprint it certifies. The committed receipt envelope is not evidence by
itself. It must point to a distinct content-addressed artifact whose bytes are
identical in `HEAD`, or to a typed private attestation that binds the external
artifact SHA-256, issuer, signing identity, subject, observation, and scoped
input fingerprint. Sensitive raw production evidence stays in the approved
private location. Private attestations remain unable to pass until the loader
has an approved trust anchor and authenticates their detached signature.

When channel or provider inputs drift, reconciliation resets the status,
gates or read-backs, observations, reviewer identities, receipt references,
and rollback proof before writing the new fingerprint. A pending row may not
be promoted to `pass` until every profile gate and the full evidence record
are populated against that current fingerprint.

`handwrytten-stationery.json` is the #740 physical-mail contract. It binds the
Handwrytten wrapper, outbox, copy, Logo source, Quiet authority stationery
specification, provider payload limits, public Blob migration, stop-generation
timestamp, and provider-version rollback boundary. It is deliberately
`candidate` with provider and physical proof pending. `pnpm
check:handwrytten-stationery` rejects missing source paths, stale specification
fingerprints, unsafe provider limits, simulated read-backs, or an attempt to
stop the retired template before both real proofs exist.

`fixture-gallery.json` is the deterministic gallery index for #722. It names
every typed atom and identity asset, Quiet primitive, pattern, interaction and quality state,
appearance mode, channel reduction, signature composition, and required
rendering profile with a stable ID and checksum. Its profile rows include web
widths, native device dispositions, large text, localization expansion,
Forced Colors, increased contrast, Reduced Motion, adaptive appearance, print,
email, SMS, provider, and metadata constraints. Rows are intentionally marked
`contract-only`: this manifest is a fail-closed rendering obligation, never a
substitute for visual captures, accessibility sessions, device recordings,
client delivery, or provider read-back. `pnpm check:design-fixtures` verifies
the typed source, profile coverage, and byte-stable generated artifact.

`pnpm check:brand-assets` runs the canonical generator in check mode. A clean
checkout must reproduce every web, marketing, native, and distribution asset
from `packages/design/src/contract`: text and vector assets are byte-for-byte.
PNG projections are compared as decoded pixels, with a quantized visual
signature fallback for renderer-level anti-aliasing differences, so
platform-specific PNG compression metadata cannot become a false source of
drift while palette, geometry, or crop changes still fail.

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
