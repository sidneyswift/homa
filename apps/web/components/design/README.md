# Quiet web primitives

This directory is the web platform adapter for `@homa/design`. The machine
contract owns semantic names, values, state vocabulary, and identity geometry.
These components own native DOM semantics, keyboard behavior, focus treatment,
and the web-specific rendering of those roles.

## Foundation primitives

- `QuietField` wraps one native input, select, or textarea. It connects the
  visible label, hint, and error to the control without replacing browser form
  behavior.
- `QuietChoice` renders a native radio or checkbox fieldset. It keeps the
  legend, option labels, disabled state, selected state, and error relationship
  reviewable in one semantic tree.
- `QuietFeedback` renders truthful constructive, information, attention, or
  system-failure feedback with the matching live-region behavior.
- `QuietIdentity` is the only web identity adapter. It delegates to the
  canonical `Logo` and does not accept alternate geometry or wordmark text.
- `QuietMedia` is the artifact and approved-imagery adapter. It preserves
  figure semantics, required alt text, a stable loading slot, and the
  artifact-first object-fit rule while allowing a route to supply its URL.

These primitives do not decide product truth, family scope, upload policy,
completion, or delivery state. Routes provide those decisions and use the
primitive to express them. Higher-level patterns require two real consumers
and their own deterministic fixture before extraction.

All controls use the 44px target floor, visible keyboard focus, disabled and
read-only styling, semantic error relationships, forced-colors fallbacks, and
the final still endpoint under Reduced Motion. Keep the older compatibility
aliases in `globals.css` frozen. New consumers should use the `--homa-*`
contract tokens through these classes.
