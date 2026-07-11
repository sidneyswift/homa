# Homa Design System · Audit log

> **Historical design record:** This file preserves July 2026 design decisions,
> experiments, and then-open items. It is not the current product, ticket, or
> implementation status source. Use `readme.md`, the reconciled PRD, the backlog,
> and current application code for present guidance.

## Senior pass, July 4, 2026 (this repository)

The system was ported from the junior repository (`Homa Design System 2/`, mounted read-only) and every open item in its audit was either fixed or explicitly decided. Generated files (`_ds_bundle.js`, manifest, lint config) were left behind to regenerate here; `uploads/` reference screenshots and the resolved `explorations/` type study were not carried over.

### Fixed in this pass

1. **Gold ink unified.** Text-on-gold used three ad-hoc hexes (`#8a6410`, `#9a7118`, `#8a6d00`). Now two tokens in `tokens/colors.css`: `--gold-ink` (`#8A6410`, the one ink on gold tints) and `--gold-ink-strong` (`#402E05`, ink on solid gold). Swept through Badge, Callout, both kits, the landing page, both DC templates, and the semantic-color card.
2. **Gold contrast fixed.** Dashboard stat tiles used white icons on solid tone fills (white-on-gold-500 was a flagged WCAG borderline). Tiles now use the system's soft-tint + deep-ink pattern (clay-50/clay-600, sage-50/sage-600, gold-100/gold-ink), matching the landing feature tiles.
3. **Icon CDN pinned.** `lucide@latest` (in 15 files) → `lucide@0.525.0`. Lucide 1.0 was a breaking release; `@latest` was a time bomb. Bump deliberately, in one sweep.
4. **Stale focus glow.** `--shadow-focus` still carried the pre-rebrand clay (`rgba(208,113,74,.20)`). Now clay-400 at 22% (`rgba(241,121,63,.22)`), matching `--focus-ring`.
5. **Planner de-borderd.** PlannerView subject blocks used the banned colored-left-border motif. Now soft tinted tiles (radius-md) with an uppercase deep-ink subject label and a right-aligned tabular duration, consistent with the landing week strip.
6. **Placeholder screens use the system.** Worksheets/Library placeholders hand-rolled their empty state; they now render the `EmptyState` component in Homa's voice ("Everything you've planned and tracked is safe.").
7. **Dark theme caught up.** Bands (`--band-*`), pops (`--pop-cobalt/-deep`, `--pop-blush`), paper rules (`--paper-rule`), and `--gold-ink` now have quiet-evening remaps in `tokens/dark.css`. (`--pop-navy` intentionally keeps its value; it reads as a deep panel on dark.)
8. **Namespace re-generated.** This project compiles to `window.HomaDesignSystem_5e2305`; all 34 files referencing the old `HOMADesignSystem_113bd2` were swept, including CLAUDE.md and SKILL.md.
9. **Docs rewritten.** `readme.md` reflects all of the above; SKILL.md quick-reference updated (pin + gold-ink rule).

### Decided, not changed

- **Sidebar stays quiet.** The junior audit wanted a "playful pass" on the web-app sidebar. Decision: navigation is chrome, not content; the sidebar's restraint is correct. Playfulness lives in views (doodles, callouts, check-offs), one or two devices per surface.
- **Playful SVG duplication stands.** Static cards, social, and DC templates carry inline copies of doodle/squiggle/house paths (React can't run there). `components/playful/` and `components/brand/Logo.jsx` are the source of truth; sync manually when paths change.

### Open, waiting on you

1. **Logo v2 pick.** Three candidates in `guidelines/brand-logo-directions.card.html` (A book home, B h-house, C morning door). Pick one → refine lockup, sweep everywhere, retire the card.
2. **Font files** for self-hosting (all four families are Google-CDN today; the manifest ships zero font binaries).
3. **Real photography** (warm lifestyle) for the landing hero slot and social templates.
4. **Worksheet physical print test.** Paper rules are 7% cobalt and should vanish on most printers; verify once on paper.
5. **Full WCAG pass.** The flagged white-on-gold case is fixed; a systematic contrast audit (esp. `--text-subtle` on band backgrounds) is still worth an hour.

## Display recast, July 4, 2026 (evening)

On request, the headline voice moved through Newsreader serif → Geist (too techy) → Figtree → EB Garamond 500 (confirmed vs a Cormorant display cut, then judged too bookish at scale) → a Fredoka test (too kids) → settled on **Schibsted Grotesk** (pick 7c in `explorations/header-sans-options.html`): **700 at hero scale, 600 for mid titles, tracked -0.015em**, with the **EB Garamond italic accent word retained inside headlines** (all italics stay EBG italic 400; pull quotes stay EBG). Sweeps: hero/section weights bumped in the landing kit, DC template, and social posters; the Type spec card rewritten. `--font-serif` still aliases EB Garamond; Fredoka remains wordmark-only. Follow-up (user feedback on the Type card): the **accent word inside headlines dropped the serif italic entirely**, it now stays Schibsted and changes color only (clay, sometimes sage); swept through landing, both app kits, social, and the DC template (14 accents). EB Garamond italic survives only in standalone moments: taglines, pull quotes, "light on purpose" asides.

## Logo recast, July 4, 2026 (evening)

The mark is decided, and it's a character: **"the little home,"** a chunky rounded clay house with bright eyes, Homa personified (warm, watchful, a little playful). A chimney + edge-to-edge smile pass was tried and reverted (it tipped creepy); the eyes-only baseline is canonical. The wordmark is **"Homa" in bounced Fredoka 600** (capital H, each letter nudged off the baseline, pick 4g from the round-4 exploration); `--font-wordmark` carries it, and it is the lockup voice only, never running text. Replaces the house+spark outline, which read bland. Source of truth: `components/brand/Logo.jsx` (`treatment="solid"` character by default, `"line"` outline for stamps/print; reversed-on-color contexts use a white body with eyes cut out in the surface color). Swept everywhere in one pass: the lockup spec card (8 instances), all six social templates, both favicon sets (which still carried the pre-rebrand `#BE5F3C` clay), and the mobile splash, whose launch moment is now "the home pops in, the eyes wake and blink." The three unpicked logo candidates card (`brand-logo-directions`) is retired.

## Dark theme v2, July 4, 2026 (night)

User feedback: "colors are weird." Diagnosis: the v1 base was muddy sepia (surfaces too yellow-brown), the brand ramp pastel-inverted (hover/active went pale peach, so pressed primaries turned pink), and several raw scales components actually use on dark were never remapped (`--sage-500` progress fills, `--clay-300` bars, upper stones used as text on bands), leaking light-theme values. v2 rebuilds `tokens/dark.css`: near-black warm neutrals with chroma turned down; brand ramp keeps direction (hover #F98F5B lighter, active #E7602F deeper); stones 500–900 flip light as text roles; full clay/sage/gold/sky/rose remaps; bands cleaned; paper rule now a faint warm cream instead of cobalt. Spec card gained a gold badge for coverage. **v3 (same night):** the card's base-tone tweak settled it, the user picked the dark blue; the shipped base is now the **night-sky slate** (cool #16171A–#262931 surfaces, cool text, cool-shifted bands and paper rules) with the warm clay/gold accents glowing against it. The card's tweaks keep warm and charcoal around for compare. **v3.1:** the first slate cut still read black on real screens; the base lifted into an unmistakably **navy** family (page #151B27, cards #1E2635, borders #2A3345–#4B586F, text/stones re-tuned to match). Also removed the line-treatment mark specimen from the Logo card on request; the `line` treatment itself stays in the component for stamps/print.

## Mark & spec-card touch-ups, July 4, 2026 (late)

- **Squiggle baseline, tried and retired.** The house's bottom edge went squiggly (two humps, then four, then a refined even wave), but even the crafted version read sloppy at small sizes; the user called it, and the baseline is back to clean and flat. The squiggle stays a page device (dividers, ribbons), not a mark device.
- **Data-viz card fixed** (flagged): the trend line ran under the KPI and its endpoint dot was clipped by the viewBox. Line now crests clear of the KPI block, the dot sits inside the canvas, the delta label no longer wraps, and "serif KPI" copy updated to the Schibsted era ("display KPI").

## System-wide "10x" pass, July 4, 2026 (late night)

The user flagged 31 assets for a senior quality pass. What changed:

- **Foundation spec cards rebuilt as working references** (radius, shadows, spacing, accent/mono, body type, display type): every token now shows its value AND its job (cards lg 22 / inputs md 16 / modals xl 28 / buttons pill; shadow ramp labeled hairline→modal with focus + inset; spacing steps annotated chip-gap→section-gap with container widths; Caveat and mono shown in real use; weight ramps with roles). The nesting rule gets its own demo.
- **Component cards: labels, states, and two brand-rule catches.** All cards gained section micro-labels and usage meta. Fixes: the Badge specimen shipped a red "Behind" label, banned by reassurance-first data (now a system-state example, with the rule printed on the card); the danger Callout now models reassure-first error copy ("your work is safe") instead of a deadline warning. Forms gained the missing Textarea; icons grid pinned note + tinted-tile usage; navigation Tabs now drive a live pane; states card gained an offline strip; logo card gained min-size + clear-space specs.
- **Landing** (flagged separately): the try-it demo was restructured for cause→effect legibility (YOU ANSWER / HOMA FINDS THE STARTING LINE column headers, numbered subject-tagged questions, no pre-filled answer, renamed legend, prominent animated result bar, cross-links removed from the small map); "From the kitchen table" retitled "What moms tell us" (read as dated); the floating "No card needed" pill became a quiet caption under the CTA buttons; thread-section spacing rebalanced.
- **Social:** carousel cover gained a content index (the three ways) + stronger outlined numeral; quote card gained an editorial ghost quote mark + "Homa family since" attribution. The other four posters were reworked earlier the same evening (layered lock-screen story, checklist tip, moment-card story, character-led promise) and were left to settle.
- **Deferred, ask before deep-diving:** full 10x passes on the three UI kits (web app, mobile app, onboarding) and the brand-device / check-off motion cards. The splash, dark theme, logo lockup, and data-viz cards were rebuilt hours earlier and intentionally not churned.
