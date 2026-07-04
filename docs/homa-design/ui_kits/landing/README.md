# Homa, Landing Page UI kit

Full marketing site recreation for Homa.

**Sections:** sticky nav, hero (with a drop-in photo slot), feature grid, "a week with Homa" planner peek, "how it works" steps, community, stories row, pricing tiers, FAQ, sunshine CTA band, footer. Color bands (aqua, warm paper, mint, blush, sunshine, navy) are divided by wave edges and by squiggle **ribbons**, fat wavy bands with a repeating phrase riding the curve (`Ribbon` in `LandingPage.jsx`).

## Files
- `index.html`, entry; loads the bundle, Lucide, and the image-slot component.
- `LandingPage.jsx`, all sections (Nav, Hero, Features, WeekPeek, HowItWorks, Community, Stories, Pricing, Faq, CtaBand, Footer) plus the `Wave` and `Ribbon` dividers.
- `image-slot.js`, drag-and-drop photo placeholder for the hero.

Composes: Button, Card, Badge, Avatar, Icon, Squiggle, Doodle. Headlines use the display serif (Newsreader) with its own italic as the accent; bands come from the `--band-*` tokens.
