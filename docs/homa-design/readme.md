# Homa Design System

**Homa** is an AI assistant for homeschooling moms, a calm, capable co-pilot. She plans the week and tracks progress, but the heart of the product is deeper: she **benchmarks each child against state/national standards through a gentle parent checklist** (a test for the mother, never the child), **generates practice targeted at exactly what's growing** (workbook pages, sensory activities), and then **proves the loop closed**, showing that the work moved the numbers. She also **connects lessons to the real world**: comparing curriculums, finding co-ops and story hours, suggesting the planetarium during space week or the zoo during the animal unit, and introducing nearby Homa families. Homa ships as a **web app** (chat + dashboards + benchmarks + discover), a **mobile app**, and a **marketing landing page** (thankshoma.com), with a growing set of **social templates**.

This repository is the single source of truth for Homa's brand: design tokens, fonts, reusable UI components, full-screen UI kits, foundation specimens, templates, and social layouts.

> **Origin & sources:** The system was designed from scratch (no prior logo, brand assets, codebase, or Figma were provided), then ported here from the working repository `Homa Design System 2/` (mounted local folder) and given a senior cleanup pass: see `AUDIT.md` for exactly what changed. If you have existing brand assets, share them and we'll reconcile.

---

## Direction: "Warm and playful"

Homa is warm at heart and playful at the edges: the schoolbook charm of a children's museum, held together by editorial restraint. Cream paper (sometimes ruled like a notebook), a coral primary with mint, sunshine, and pool-aqua friends, clean modern headlines (Schibsted Grotesk) with a clay accent word, the little-home character mark beside the bounced "Homa" wordmark, chunky pill buttons, blob-masked photos, squiggle dividers, wavy section edges, and little hand-placed doodles. Rule of restraint: **one or two playful devices per surface, never all of them at once.**

---

## Brand foundation, who we're for

**She isn't short on tools. She's short on bandwidth and reassurance.** The homeschooling mom is teacher, planner, principal, and parent at once. Underneath the logistics runs one quiet, constant fear: *"Am I doing enough? Are my kids behind? Am I enough?"* She's often isolated, measuring herself against picture-perfect homeschool Instagram, and carrying guilt about the messy days.

**The emotional job:** move her from *overwhelmed & unsure* → *calm & confident*.

### The promise (say it everywhere)

> **You've got this. Homa's got the rest.**

Every surface should express one feeling, **calm**, and one relationship, **a companion in your corner.** Tagline: *"Homeschooling, made calm."*

### Five things that make it *feel* like the solution

1. **Homa is a presence, not a product.** A warm daily greeting, gentle nudges, and *permission* ("a lighter day is still a good day"). In the UI: the recurring **"A note from Homa"** pattern (`Callout`, mobile Home).
2. **An ownable device, "Homa's hand."** The **notebook margin-rule** (a clay vertical line, the workbook margin) and **Homa's handwriting** (Caveat, always **sage**, one margin note per surface, max). Plus the **checkmark / gold-star** language for progress. See `guidelines/brand-device.card.html`.
3. **Reassurance-first data.** **No red "BEHIND" labels, ever.** Lead with growth, effort, streaks, "on track"; celebrate small wins. The dashboard should *calm* her, not audit her.
4. **Proof, gently.** The benchmark checklist is a test for the mother, never the child. Homa targets practice, then shows the needle move: "Math is up 12 points since the fractions set." See `ui_kits/web-app/BenchmarksView.jsx`.
5. **Connected to her world.** The planetarium during space week, story hour Thursday, four Homa families within five miles. See `ui_kits/web-app/DiscoverView.jsx`.

---

## Content fundamentals

**Voice:** Homa is a warm, competent companion, the friend who's also a veteran homeschooler. She *offers*, she never *commands*.

- **Person:** Second person ("you," "your kids," "Maya"). Homa says "I" sparingly ("I'll draft that for you").
- **Tone:** Encouraging, concrete, calm. Celebrates effort; normalizes lighter weeks. Never preachy, never guilt-inducing, never corporate.
- **Casing:** Sentence case everywhere, headings, buttons, labels. The brand name is **Homa** in copy, never all-caps; the wordmark renders **Homa**, capital H. Overlines/eyebrows may be uppercase with wide tracking.
- **Length:** Short. A sentence beats a paragraph. Lead with the helpful thing.
- **Emoji:** Rare and warm, at most one per message (a ☀️ on a morning greeting). Never as bullets or in dense UI.
- **Punctuation:** **No em dashes, ever** (hard rule, see `CLAUDE.md`). Use a comma, a period, a colon, or a mid-dot (·).
- **Numbers & jargon:** Plain language. "About 1h 45m," not "105 minutes." No "modules," no "leveraging."

**Examples**

- ✅ "Maya's flying through fractions, ready to try some word problems?"
- ✅ "Good morning, Sarah ☀️ What are we tackling today?"
- ❌ "The system has generated a curriculum for the student."

Homa's reusable phrases (encouragement, empty/loading, errors, nudges) live in `guidelines/copy-kit.card.html`. Core rules: reassure before you inform; name the child, name the win; errors reassure first ("your work is safe") then give the fix.

---

## Visual foundations

**Color.** Warm and bright, built on warm-tinted neutrals (stone), never gray.
- **Primary, Clay/Coral** (`--brand` = `#E7602F`): main actions, active nav, brand moments. Hover `--clay-600`, active `--clay-700`.
- **Secondary, Sage/Mint** (`#3D9A50`): success, "on track," fresh accents.
- **Accent, Gold/Sunshine** (`#F0BE00`, tints to `#FFD43B`): milestones, highlights, "ahead." Text/icons on gold tints are **always `--gold-ink`** (`#8A6410`); on solid gold, `--gold-ink-strong` (`#402E05`). Never white on gold.
- **Info, Sky/Aqua** (`#4FB4D6`). **Danger, warm coral-red** (`#E2593B`), never harsh pure red.
- **Pops** (sparingly: doodles, bands, moments): `--pop-cobalt` `#2E6BE6`, `--pop-blush` `#F49A90`, `--pop-navy` `#23304F`.
- **Section bands** (full-bleed playful backgrounds): `--band-sky`, `--band-mint`, `--band-blush`, `--band-sunshine`. One or two per page; a band edge is EITHER a wave OR a squiggle ribbon (the ribbon is the seam itself, two section colors meeting under it), never both at one boundary.
- **Surfaces:** page is warm cream `--bg-page` (`#FBF7F0`); cards are white; `--bg-paper` layers ruled notebook lines over cream.
- **Text:** warm near-black `--text-strong` through `--text-body / muted / subtle`, all warm stones.
- **Dark theme (experimental):** "quiet evening" **v4, night sky, sunshine forward**, set `data-theme="dark"` on any subtree (`tokens/dark.css`). The base is a visibly navy dark blue (`#151B27` page, `#1E2635` cards) where **sunshine-gold primaries and baby-blue accents** do the glowing (ink on gold is always deep, never white on gold); clay steps back after dark, reserved for the character mark; upper stones flip light-and-cool as text roles, and every raw scale components lean on remaps (tints, tracks, bars, bands, pops, paper rules). Light is the default.

**Type.**
- **Display, Schibsted Grotesk** (`--font-display`): all headlines, big numbers, dialog titles. Clean modern grotesque with warm curves; **700 at hero scale, 600 for mid/card titles**, tracked `-0.015em`.
- **Serif accent, EB Garamond** (`--font-serif`): standalone italic moments only, taglines under a greeting, pull quotes, testimonials, "light on purpose" asides (italic 400; quote blocks roman 400–500). **The accent word inside a headline is NOT serif**: it stays Schibsted and changes color only (usually clay). Never UI chrome, never a headline on its own.
- **Wordmark, Fredoka 600** (`--font-wordmark`): the bounced "Homa" lockup only, each letter nudged off the baseline (see `Logo`). Never running text, never headlines.
- **UI & body, Hanken Grotesk** (`--font-sans`): everything in the interface. 400 body, 500–700 emphasis/labels.
- **Homa's hand, Caveat** (`--font-hand`, always weight 600, always sage): one margin note per surface, max, delight only.
- **Mono, JetBrains Mono** (`--font-mono`): data, scores, percentages.
- Scale `--text-2xs → --text-5xl`; display headings track `-0.015em`. Two voices per screen plus body, never four.

**Spacing & layout.** 4px base (`--space-1..24`). Generous, airy. Prose maxes at `--container-md` (820px), app shells `--container-xl` (1280px). Grid/flex with `gap`, never margin hacks. Collapse to one column below ~720px; the app sidebar becomes a bottom tab bar on mobile; 44px+ hit targets.

**Corners & shapes.** Soft, never sharp. Cards `--radius-lg` (22px); buttons/chips are **pill**; inputs `--radius-md` (16px); modals `--radius-xl` (28px). Playful layer: **blob masks** (`--blob-1` through `--blob-5`), the **Squiggle** divider, **wavy band edges**, ruled **notebook paper** (`--bg-paper`), **Doodle** stickers rotated a few degrees. One or two per surface. **Never** the "colored left-border card" trope: subject/plan tiles are soft tinted fills with deep-ink labels.

**Shadows.** Soft, diffuse, **warm-tinted** (brown `rgba(51,42,33,…)`, never black). `--shadow-sm` resting, `--shadow-lg` hover-lift, `--shadow-xl` modals. Focus is a clay glow (`--shadow-focus`), never blue.

**Backgrounds & imagery.** Mostly flat warm color and white cards. One editorial exception: the clay gradient (`160deg, clay-400 → clay-600`) on the login side panel and social quote cards. Imagery is **warm lifestyle photography**, real families, cozy natural light, in rounded/blob slots. No cool stock, no heavy filters. (Placeholders today; supply real photos.)

**Motion.** Gentle and quick, **no bounce** in UI (the splash character's squash-and-bounce landing is the one sanctioned exception). `--ease-out` = `cubic-bezier(0.22, 0.8, 0.28, 1)`. Hovers ~120ms (`--dur-fast`), entrances 200–320ms. Hover: darken buttons, lift cards (`translateY(-2px)`, deepen shadow). Press: `scale(0.98)`. **The check-off** (signature micro-interaction): circle fills sage with a 350ms pop, a gold star floats up (800ms), the title quiets to strike-through. Undoable, never a modal, never confetti. See `guidelines/motion-check-off.card.html`.

**Data-viz.** Warm and calm (`guidelines/data-viz.card.html`). Bars in clay-300 (clay-500 emphasis, sage goal-met), rounded tops, hairline baseline; one sage trend line with endpoint dot and display KPI. Growth framing always ("▲ 6 this month"); never red down-arrows on a child's chart. Numbers use `--font-mono` / tabular figures.

**Borders.** Hairline, warm: `--border-subtle` (stone-200) on cards, `--border-default` (stone-300) on inputs, 1.5px on interactive fields.

**Transparency & blur.** Light and purposeful: sticky nav `rgba(cream,.85)` + `blur(10px)`; modal scrim warm `rgba(51,42,33,.42)` with a small blur.

---

## Iconography

- **Canonical set: [Lucide](https://lucide.dev), pinned at `lucide@0.525.0`** (unpkg CDN) in every card, kit, and template. Rounded joins, 1.75 stroke, friendly-but-precise. Wrapped by the `Icon` component.
- **Why pinned:** Lucide 1.0 (2026) was a breaking release; `@latest` would have rippled everywhere. Bump deliberately, in one sweep.
- **Substitution flag:** Lucide is a stand-in because no in-house icon set was provided. To self-host, swap the CDN `<script>` and adjust `Icon.jsx`.
- **No hand-rolled SVGs** for UI glyphs, always `Icon`. (A few tiny inline SVGs live *inside* components for check/chevron/close marks that must render without the icon script; the playful doodle/squiggle/house paths are duplicated by design in static cards, with `components/playful/` and `components/brand/Logo.jsx` as source of truth.)
- **Emoji:** occasional and warm, per Content fundamentals, never an icon system.
- **Common glyphs:** `sparkles` (Homa / AI), `book-open`, `graduation-cap`, `calendar`, `chart-line`, `file-pen` (worksheets), `heart`, `award`, `clipboard-list`, `compass`.

---

## Components

Reusable primitives in `components/<group>/`, each with `.jsx` + `.d.ts` + `.prompt.md` and a directory `@dsCard` HTML. Namespace: `window.HomaDesignSystem_5e2305` (confirm with `check_design_system`).

- **actions/**: `Button`, `IconButton`
- **brand/**: `Logo` ("the little home" character mark, a rounded clay house with bright eyes, + the bounced Fredoka "Homa" wordmark)
- **forms/**: `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Chip`
- **layout/**: `Card`
- **data-display/**: `Badge`, `Avatar`, `ProgressBar`
- **feedback/**: `Callout`, `Dialog`, `Toast`
- **states/**: `Skeleton`, `EmptyState` (loading & empty, in Homa's voice; use it for every placeholder screen)
- **playful/**: `Squiggle` (heading divider), `Doodle` (10 hand-placed sticker shapes: star, heart, sun, sparkle, squiggle, flower, cloud, moon, zigzag, loop)
- **navigation/**: `Tabs`
- **media/**: `Icon` (Lucide wrapper)

**Intentional additions** (from-scratch build, no source inventory): `Icon` (standardizes Lucide), `Callout` (Homa's in-page voice), `Chip` (subject selection is core), `ProgressBar` (progress is core). Each earns its place.

---

## UI kits

Full-screen, interactive recreations in `ui_kits/<product>/` (each has its own README):

- **web-app/**: login → shell with **Ask Homa** chat, **Progress** dashboard, **Benchmarks** (checklist + impact proof), **Week planner**, **Discover**, **Curriculum**; plus first-run **onboarding** (`onboarding.html`).
- **mobile-app/**: phone-framed app, Home (check-off celebration), Ask, Plan, Discover, Kids, bottom tabs; `splash.html` is the animated launch moment.
- **landing/**: marketing site, hero, features, the **story thread** (scroll-driven chapters on the notebook margin-rule, waypoints check off as you pass), the **benchmark demo** (answer three gentle questions, watch the skill map redraw; deeper mechanics behind one toggle), community, stories, pricing, FAQ, CTA band, footer.

---

## Repository index

- `styles.css`, **entry point**; `@import`s every token file. Consumers link this one file.
- `tokens/`: `fonts.css`, `colors.css`, `dark.css`, `shapes.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`, `motion.css`, `base.css` (page-level font/color defaults).
- `components/`: reusable primitives (list above).
- `ui_kits/`: `web-app/`, `mobile-app/`, `landing/`.
- `templates/`: starting points for consuming projects, **Landing Page**, **Web App Shell**, **Printable Worksheet** (US Letter: a student page plus a parent key page with coaching notes and a "how did it go" check-in; `showAnswers` and `parentKey` tweaks), each a `.dc.html` built on the system.
- `assets/`: brand renders (`brand/homa-character-2048.png` transparent character mark, `brand/homa-app-tile-2048.png` app icon), photography (`photos/hero-family.png`), and film (`videos/homa-brand-film.mp4`, 15s, plays from the landing hero's "Watch the film"). Source of truth for the mark stays `components/brand/Logo.jsx`.
- `guidelines/`: foundation specimen cards (Brand, Colors, Type, Spacing) for the Design System tab.
- `social/`: social templates (post, quote, story, carousel, notification, promise).
- `AUDIT.md`: the senior-pass changelog and the open items.
- `CLAUDE.md`: hard project rules (em dashes, brand casing).
- `SKILL.md`: Agent-Skills-compatible entry for Claude Code.
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`: **auto-generated**, never edit.

---

## Caveats & how to help make this perfect

- **Fonts are Google-hosted** (Schibsted Grotesk / EB Garamond / Fredoka / Hanken Grotesk / Caveat / JetBrains Mono), so the manifest ships zero font binaries. Send brand font files and we'll self-host.
- **Imagery:** the landing hero now carries a real photo (`assets/photos/hero-family.png`, warm kitchen-table lesson). Social templates still use placeholder slots; drop in more photography anytime.
- **Worksheet print test:** paper rules print at 7% cobalt; run one physical print before shipping to families.
