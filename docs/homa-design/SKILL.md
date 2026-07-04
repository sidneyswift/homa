---
name: homa-design
description: Use this skill to generate well-branded interfaces and assets for Homa (an AI assistant for homeschooling families), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick reference
- **Entry CSS:** `styles.css` (imports all tokens). Link it, then use CSS custom properties, `--brand` (coral `#E7602F`), `--sage-500` (mint), `--gold-400` (sunshine), `--sky-500` (aqua), pops (`--pop-cobalt`, `--pop-blush`, `--pop-navy`), bands (`--band-sky/mint/blush/sunshine`), playful shapes (`--blob-1/2/3`, `--bg-paper`), `--bg-page` (warm cream), `--text-strong/body/muted/subtle`, radii (`--radius-lg` cards, `--radius-pill` buttons), `--shadow-sm/lg`, `--ease-out`. Dark theme: `data-theme="dark"` on any subtree (experimental).
- **Fonts:** Newsreader (`--font-display` and `--font-serif`, one family: headlines, lowercase wordmark, big numbers, plus italic accent words and quotes), Hanken Grotesk (sans UI/body), Caveat (Homa’s hand, product margin notes only, one per surface), JetBrains Mono (data). Keep it to two voices per screen plus body.
- **Icons:** Lucide via CDN. Never hand-draw UI glyphs.
- **Components:** in `components/<group>/`. In HTML, load `_ds_bundle.js` and read `const { Button, Card, ... } = window.HOMADesignSystem_113bd2`. Each has a `.prompt.md` with usage.
- **Voice:** warm, second-person, encouraging, sentence case, minimal emoji. Homa offers, never commands. No em dashes, ever (use a comma, period, colon, or mid-dot instead).
- **Full-screen examples:** `ui_kits/{web-app,mobile-app,landing}/`. Social layouts: `social/`.

Do not edit `_ds_bundle.js`, `_ds_manifest.json`, or `_adherence.oxlintrc.json`, they are generated.
