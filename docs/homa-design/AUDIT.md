# Homa Design System · Senior design audit

Date: July 3, 2026. A fresh-eyes pass over every surface after the playful rebrand. Three buckets: what was fixed in this pass, what is drifting and needs a decision or love, and what is blocked on materials only you can provide.

## Fixed in this pass

- **Display font recalibrated.** Baloo 2 read too young; display is now **Bricolage Grotesque** (chunky, characterful, grown-up), with Newsreader kept strictly as the serif italic accent. Updated in tokens, splash, type card, docs.
- **Brand casing unified.** Copy says **Homa**; the wordmark/logo is lowercase **homa**; all-caps HOMA eliminated from every source file (the compiled bundle regenerates from clean sources). Rule locked in CLAUDE.md + readme + copy kit.
- **Button weight** bumped to 700 to match the chunkier direction.
- Stale bits: old-brand hex in the onboarding favicon, "MADE WITH HOMA" caps in the worksheet, social README still claiming "serif headlines" and an "espresso" quote card, radius spec labels showing pre-bump values, nav links wrapping on the landing page.
- **Global font inheritance (root-caused).** Surfaces relied on inline fontFamily; anything without one fell back to the UA serif (caught on mobile, latent everywhere). Fix: `tokens/base.css` now sets body sans + heading display font for every page linking `styles.css`, and the web/mobile shells set it explicitly as well.
- **Type sweep (July 4).** (a) Wordmark spec unified: Bricolage **700**, tracking **-0.01em**, lowercase **homa**, everywhere. The lockup spec card itself had drifted (600 / +0.005em / capital "Homa") and all six social templates carried 600. (b) Landing template's footer tagline was display-font + `font-style:italic`, a faux oblique (Bricolage has no italic); now Newsreader serif italic, the system's one italic voice. (c) Homa's hand standardized at **Caveat 600 explicit** in all 14 usages; it was unweighted, silently resolving to 500 via nearest-weight fallback. (d) Removed the 16 per-file Google Fonts `<link>` subsets (guidelines, social, splash), several still loading Newsreader-era wordmark weights; `tokens/fonts.css` is the single font source. (e) Stale "display uses Newsreader serif" comment in `tokens/typography.css` and the readme's font list (missing Bricolage) corrected.
- **Type recast (July 4, later).** Review verdict: the grotesque display wasn't loved, and four voices in one viewport (grotesque + serif italic + handwriting + sans) was too many. Display is now **Newsreader**, the same family as the italic accent, so headline + accent collapse into one voice and marketing pages run on two families plus mono for data. Wordmark: Newsreader 600, lowercase homa (was Bricolage 700; Newsreader loads no 700). Caveat is product-surface-only now, one margin note per surface; the landing hero's handwritten note (which repeated the headline copy) was removed from kit + template. Bricolage Grotesque retired from the font import; docs, spec cards, and SKILL updated.

## Drifting · needs a decision or another pass

1. **Gold ink inconsistency.** Text-on-gold uses three ad-hoc hexes (`#8a6410`, `#9a7118`, `#8a6d00`) across cards, kits, and Badge/Callout internals. Add one `--gold-ink` token and sweep.
2. ~~**"Homa's hand" color rule drifted.**~~ **Resolved:** the handwritten note is **sage everywhere** (landing + template swept to sage-600).
3. ~~**Wave dividers are inconsistent.**~~ **Resolved:** waves are a system-wide band-edge device (marketing and product). Landing now waves at every band edge (aqua→cream, cream→mint→cream, cream→navy footer); template matches. Remaining: add waves if bands ever appear inside app views.
4. **Logo v2 in progress.** The current house+spark is the baseline; `guidelines/brand-logo-directions.card.html` now shows three stronger candidates (A book home, B h-house, C morning door). **Waiting on a pick**, then: refine into the full lockup, swap everywhere, retire the card.
5. **Planner and Sidebar never got the playful/premium pass.** Planner still uses left-border subject blocks and old density; Sidebar is plain. Worksheets and Library nav items are placeholder screens.
6. **Icon CDN is unpinned.** `lucide@latest` is loaded in ~12 files; a breaking Lucide release would ripple everywhere. Pin a version once and sweep.
7. **Playful SVGs are duplicated by design.** Static cards, social, and DC templates carry inline copies of the doodle/squiggle/house paths (React components can't run there). Fine, but they will drift; treat `components/playful/` and `components/brand/Logo.jsx` as the source of truth and sync manually when paths change.
8. **Contrast spot-checks.** White icon on gold-500 stat tile (Dashboard milestones) is borderline; gold badge/solid pairs and `--text-subtle` on band backgrounds deserve a proper WCAG pass. No red flags on the coral/sage pairs.
9. **Dark theme lags the playful pass.** Bands, pops, and paper lines have no dark-mode remaps (they are currently unused on dark surfaces, so cosmetic only). Splash and check-off animations inherited the new coral correctly.
10. ~~**Mobile IA nit.**~~ **Resolved:** Plan is back in the mobile tab bar (Home / Ask / Plan / Discover / Kids) with a compact week screen.
11. **Worksheet print check.** The new ruled-paper background sits behind exercises; lines are 7% cobalt so they should disappear on most printers, but run one physical print test before shipping to families.

## Waiting on you

- **Font files** for self-hosting (everything is Google-CDN today; the manifest ships zero font binaries).
- **Real photography** (warm lifestyle) for the landing hero image slot and social templates.
- A call on audit items **2, 3, 4, 10** above, then I sweep.
