# Homa, Landing Page UI kit

Full marketing site recreation for Homa.

> Production divergence note (2026-07-06): the shipped landing page
> (`apps/web/app/page.tsx`) deliberately departs from this kit in two
> places by founder call: the hero's brand-film overlay ("Watch the film")
> was removed, and the pricing-tiers section is replaced by the invite
> band (`InviteBand.tsx`; ruling T2, no pricing on the page). This kit
> stays the design source for everything else.

**Sections:** sticky nav, hero (real photo, plus a 15s brand-film overlay behind "Watch the film"), feature grid, **the story thread** (a scroll-driven chapter sequence on ruled notebook paper: a squiggly clay thread wanders down the page and inks in as you scroll, a marker rides the curve, and each chapter's waypoint checks off sage as you pass, 01 tell Homa about your kids · 02 the week arrives · 03 teach, tap, done · 04 proof), **the benchmark demo** (three gentle checklist questions live-redraw a skill map; the technical mechanics fold behind one "peek under the hood" toggle), community, stories row, pricing tiers, FAQ, sunshine CTA band, footer. Section seams are either a single wave edge or a squiggle **ribbon**, a fat wavy band with a repeating phrase riding the curve (`Ribbon` in `LandingPage.jsx`). A ribbon IS the seam: the two section colors meet along its centerline (its `top`/`bottom` props), so never stack a wave and a ribbon at the same boundary.

## Files
- `index.html`, entry; loads the bundle, Lucide, and the image-slot component.
- `LandingPage.jsx`, all sections (Nav, Hero, Features, WeekPeek, HowItWorks, Community, Stories, Pricing, Faq, CtaBand, Footer) plus the `Wave` and `Ribbon` dividers.
- `image-slot.js`, drag-and-drop photo placeholder for the hero.

Composes: Button, Card, Badge, Avatar, Icon, Squiggle, Doodle. Headlines use the display serif (EB Garamond) with its own italic as the accent word; bands come from the `--band-*` tokens.
