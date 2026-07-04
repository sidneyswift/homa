# HOMA Design System

**HOMA** is an AI assistant for homeschooling moms, a calm, capable co-pilot. She plans the week and tracks progress, but the heart of the product is deeper: she **benchmarks each child against state/national standards through a gentle parent checklist** (a test for the mother, never the child), **generates practice targeted at exactly what's growing** (workbook pages, sensory activities), and then **proves the loop closed**, showing that the work moved the numbers. She also **connects lessons to the real world**: comparing curriculums, finding co-ops and story hours, suggesting the planetarium during space week or the zoo during the animal unit, and introducing nearby HOMA families. HOMA ships as a **web app** (chat + dashboards + benchmarks + discover), a **mobile app**, and a **marketing landing page**, with a growing set of **social templates**.

This repository is the single source of truth for HOMA's brand: design tokens, fonts, reusable UI components, full-screen UI kits, foundation specimens, and social layouts.

> **Origin & sources:** This system was designed **from scratch**, no prior logo, brand assets, codebase, or Figma file was provided. All colors, type, and components below are original choices for HOMA. If you have existing brand assets, share them and we'll reconcile the system to match (see *Caveats* at the bottom).

---

## Direction: "Quiet warmth"

HOMA is warm, but the warmth is **quiet and editorial**, premium the way fine stationery or a well-made journal is premium, not cozy-craft. Cream paper, terracotta restraint, sage calm, a whisper of gold. The system leans on **serif headlines with italic accents, hairline rules, generous negative space, small letter-spaced labels, and a single accent per surface**. Color whispers; type does the work. Nothing shouts, and nothing feels cheap.

---

## Brand foundation, who we're for

**She isn't short on tools. She's short on bandwidth and reassurance.** The homeschooling mom is teacher, planner, principal, and parent at once, a stack of invisible labor most people never see. Underneath the logistics runs one quiet, constant fear: *"Am I doing enough? Are my kids behind? Am I enough?"* She's often isolated (no staff room, no colleague to say "you're doing fine"), measuring herself against picture-perfect homeschool Instagram, and carrying guilt about the messy days.

**What she wants:** to feel **calm, capable, and not alone**, an experienced friend in her corner who takes the mental load off her plate and quietly reassures her that her kids are okay and she's doing a good job.

**The emotional job:** move her from *overwhelmed & unsure* → *calm & confident*.

### The promise (say it everywhere)

> **You've got this. HOMA's got the rest.**

It affirms *her*, the teaching, the patience, the love, the part only she can do, and offloads the doubt and admin (planning, tracking, "what do we do today?"). Every surface should express one feeling, **calm**, and one relationship, **a companion in your corner.** Tagline: *"Homeschooling, made calm."*

### Five things that make it *feel* like the solution

1. **HOMA is a presence, not a product.** A consistent, reassuring voice with signature moments, a warm daily greeting, gentle nudges, and *permission* ("a lighter day is still a good day"). It shows up in the UI as the recurring **"A note from HOMA"** pattern (see the `Callout` component and the mobile Home screen).
2. **An ownable, homeschool-specific device, "HOMA's hand."** Two signatures rooted in her world: the **notebook margin-rule** (a clay vertical line, the workbook margin) and **HOMA's handwriting** (the Caveat accent, used deliberately as a personal margin note, *one per surface, max*). Plus a **checkmark / gold-star** language for progress: the "good job" of childhood, reclaimed. See `guidelines/brand-device.card.html` and `social/brand-promise.html`.
3. **Reassurance-first data.** Progress never triggers the "are they behind?" fear. **No red "BEHIND" labels, ever.** Lead with growth, effort, streaks, and "on track"; celebrate small wins. The dashboard should *calm* her, not audit her.
4. **Proof, gently, the ultimate selling point.** The benchmark checklist is *a test for the mother, never the child* ("Does he count to 120? Not yet, that's just what's next"). HOMA targets practice at what's growing, then **shows the needle move**: "Math is up 12 points since the fractions set." Validation of her journey is the deepest value HOMA delivers. See `ui_kits/web-app/BenchmarksView.jsx`.
5. **Connected to her world.** Lessons reach outward, the planetarium during space week, red pandas at the zoo during the animal unit, story hour Thursday, the Tuesday co-op, four HOMA families within five miles. She is not alone, and the plan knows her town. See `ui_kits/web-app/DiscoverView.jsx`.

---

## Content fundamentals

**Voice:** HOMA is a warm, competent companion, the friend who's also a veteran homeschooler. She *offers*, she never *commands*.

- **Person:** Second person ("you," "your kids," "Maya"). HOMA refers to herself as "I" sparingly and only when helpful ("I'll draft that for you").
- **Tone:** Encouraging, concrete, calm. Celebrates effort and progress; normalizes lighter weeks and off days. Never preachy, never guilt-inducing, never corporate.
- **Casing:** Sentence case everywhere, headings, buttons, labels. The wordmark **HOMA** is the only all-caps element. Overlines/eyebrows may be uppercase with wide tracking.
- **Length:** Short. A sentence beats a paragraph. Lead with the helpful thing.
- **Emoji:** Rare and warm, at most one per message, and only where it adds warmth (a ☀️ on a morning greeting). Never as bullet decoration or in dense UI.
- **Punctuation:** **no em dashes, ever** (hard rule). Use a comma, a period, a colon, or a mid-dot (·) separator instead.
- **Numbers & jargon:** Plain language. "About 1h 45m," not "105 minutes." Avoid edtech jargon ("modules," "the system," "leveraging").

**Examples**

- ✅ "Maya's flying through fractions, ready to try some word problems?"
- ✅ "You've got this. Here's a lighter week."
- ✅ "Good morning, Sarah ☀️ What are we tackling today?"
- ❌ "The system has generated a curriculum for the student."
- ❌ "You must complete all assigned modules to proceed."

The handwritten Caveat accent ("try this ✎", "swipe up") is HOMA's margin-note voice, used **once per layout at most**, for delight, never for critical information.

---

## Visual foundations

**Color.** Warm, earthy, low-saturation. The palette is built on warm-tinted neutrals (stone), not gray.
- **Primary, Clay/Terracotta** (`--brand` = `#BE5F3C`): main actions, active nav, brand moments. Hover darkens to `--clay-600`; active to `--clay-700`.
- **Secondary, Sage** (`#627A50`): success, "on track," calm accents, outline buttons.
- **Accent, Gold/Butter** (`#D9A441`): milestones, highlights, "ahead" states.
- **Info, Sky** (`#6E93A8`). **Danger, a soft clay-red** (`#C0492E`), never a harsh pure red.
- **Surfaces:** page is warm cream `--bg-page` (`#FBF7F0`); an alternate warm band `--bg-page-warm` creates section rhythm; cards are pure white.
- **Dark theme (experimental):** "quiet evening", set `data-theme="dark"` on any subtree. Warm espresso surfaces, remapped tint roles so components adapt wholesale. Defined in `tokens/dark.css`, demoed in `guidelines/dark-mode.card.html`. Light is the default and primary theme.
- **Text:** warm near-black `--text-strong` down through `--text-body / muted / subtle`, all warm-tinted stones, never cool gray.

**Type.**
- **Display, Newsreader** (serif, optical sizing): all headlines, hero copy, big numbers, dialog titles. Weights 500–600. Occasional *italic* on an emphasis word (the "calm" in "made calm").
- **UI & body, Hanken Grotesk** (humanist sans): everything in the interface and all reading copy. 400 body, 500–700 for emphasis/labels.
- **Accent, Caveat** (handwritten): sparingly, for delight only.
- **Mono, JetBrains Mono**: data, scores, percentages, code.
- Type scale runs `2xs → 5xl`; headings lean on tight tracking (`-0.02em`).

**Spacing & layout.** 4px base scale (`--space-1..24`). Generous, airy padding, cards breathe. Content maxes out at comfortable reading widths (`--container-md` 820px for prose, `--container-xl` 1280px for app shells). Grid + flex with `gap`, never margin hacks. Responsive: collapse multi-column grids to one column below ~720px; the app sidebar becomes a bottom tab bar on mobile (see the mobile kit); keep 44px+ hit targets throughout.

**Copy kit.** HOMA's reusable phrases, encouragement, empty/loading, errors, nudges, live in `guidelines/copy-kit.card.html`. Core rules: reassure before you inform; name the child, name the win; offer, never command; errors reassure first ("your work is safe") then give the fix.

**Corners.** Soft and rounded, never sharp. Cards use `--radius-lg` (18px); buttons and chips are fully **pill** (`--radius-pill`); inputs `--radius-md` (14px); modals `--radius-xl` (24px).

**Shadows.** Soft, diffuse, **warm-tinted** (brown `rgba(51,42,33,…)`, never black/gray). `--shadow-sm` on resting cards, `--shadow-lg` on hover/lift, `--shadow-xl` on modals. Inputs get a clay focus glow (`--shadow-focus`), not a blue one.

**Backgrounds & imagery.** Mostly flat warm color and white cards. One editorial exception: the clay **gradient** (`160deg, clay-400 → clay-600`) used on the login side panel and social quote cards. Imagery direction is **warm lifestyle photography**, real families, cozy natural light, warm tones, dropped into rounded slots (see `ui_kits/landing/image-slot.js`). No stock-y cool imagery, no heavy filters. (Placeholders are used throughout; supply real photos to finalize.)

**Motion.** Gentle and quick, **no bounce**. `--ease-out` = `cubic-bezier(0.22, 0.8, 0.28, 1)`. Hovers ~120ms, entrances ~200–320ms.
- **Hover:** buttons darken; cards lift (`translateY(-2px)`) and deepen shadow.
- **Press:** subtle shrink to `scale(0.98)`.
- **Focus:** clay ring via `--shadow-focus` + border color shift, built into Button, Chip, Tabs, Input, Select.
- **The check-off** (signature micro-interaction): circle fills sage with a 350ms pop, a gold star floats up and fades (800ms), the title quiets to a strike-through. Undoable. Never a modal, never confetti. See `guidelines/motion-check-off.card.html` and the mobile Home screen.
- **Launch:** the splash draws the home mark, wakes the spark, settles the promise (`ui_kits/mobile-app/splash.html`).

**Data-viz.** Warm and calm, see `guidelines/data-viz.card.html`. Bars in clay-300 (clay-500 emphasis, sage goal-met), rounded tops, hairline baseline only; trends as one sage line with an endpoint dot and a serif KPI. Growth framing always ("▲ 6 this month"); never red down-arrows on a child's chart. Numbers use `--font-mono`/tabular figures.

**Borders.** Hairline, warm. `--border-subtle` (stone-200) on cards; `--border-default` (stone-300) on inputs; `1.5px` weight on interactive fields.

**Transparency & blur.** Used lightly and purposefully: the sticky nav uses `rgba(cream, .85)` + `backdrop-filter: blur(10px)`; the modal scrim is a warm `rgba(51,42,33,.42)` with a small blur.

---

## Iconography

- **Canonical set: [Lucide](https://lucide.dev)** (CDN). Rounded joins, `1.75` stroke weight, friendly-but-precise, a great match for the warm humanist tone. Wrapped by the `Icon` component.
- **Substitution flag:** Lucide is used because no in-house icon set was provided. It's loaded from `unpkg.com/lucide@latest` in every card and kit. To pin or self-host, swap the CDN `<script>` and adjust `Icon.jsx`.
- **No hand-rolled SVGs** for UI glyphs, always use `Icon`. (A handful of tiny inline SVGs exist *inside* components for check/chevron/close marks that must render without the icon font.)
- **Emoji:** occasional and warm, per Content Fundamentals, never as an icon system.
- **Common glyphs:** `sparkles` (HOMA / AI), `book-open`, `graduation-cap`, `calendar`, `chart-line`, `pencil`/`file-pen` (worksheets), `heart`, `award`, `clipboard-list`.

---

## Components

Reusable primitives live in `components/<group>/`, each with `.jsx` + `.d.ts` + `.prompt.md` and a directory `@dsCard` HTML. Namespace: `window.HOMADesignSystem_113bd2` (run `check_design_system` to confirm). Built:

- **actions/**, `Button`, `IconButton`
- **brand/**, `Logo` (the "bright home" mark + wordmark lockup)
- **forms/**, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch`, `Chip`
- **layout/**, `Card`
- **data-display/**, `Badge`, `Avatar`, `ProgressBar`
- **feedback/**, `Callout`, `Dialog`, `Toast`
- **states/**, `Skeleton`, `EmptyState` (loading & empty, in HOMA's voice)
- **navigation/**, `Tabs`
- **media/**, `Icon` (Lucide wrapper)

**Intentional additions** (not from a source inventory, this was a from-scratch build): `Icon` (needed to standardize Lucide usage), `Callout` (HOMA's in-page "voice"), `Chip` (subject/topic selection is central to the product), `ProgressBar` (progress tracking is a core feature). Each earns its place against HOMA's feature set.

---

## UI kits

Full-screen, interactive recreations in `ui_kits/<product>/` (each has its own README):

- **web-app/**, desktop app: login → shell with **Ask HOMA** chat, **Progress** dashboard, **Benchmarks** (skills checklist + standards + impact proof), **Week planner**, **Discover** (lesson-matched outings, co-ops, nearby HOMA families), **Curriculum** (side-by-side comparison, fit-matched); plus **onboarding** (`onboarding.html`: add kids → subjects → HOMA drafts the week).
- **mobile-app/**, phone-framed app: Home (check-off celebration), Ask HOMA, Discover, and Kids (benchmarks) with bottom-tab nav.
- **landing/**, marketing site: hero, features, how-it-works, testimonial, pricing, footer.

---

## Repository index

- `styles.css`, **entry point**; `@import`s every token file. Consumers link this one file.
- `tokens/`, `fonts.css`, `colors.css`, `typography.css`, `spacing.css`, `radius.css`, `shadows.css`, `motion.css`.
- `components/`, reusable UI primitives (see above).
- `ui_kits/`, `web-app/`, `mobile-app/` (incl. `splash.html`, the animated launch moment), `landing/`.
- `templates/`, one-click starting points for consuming projects: **Landing Page** (`templates/landing-page/`), **Web App Shell** (`templates/web-app/`), and **Printable Worksheet** (`templates/worksheet/`, with a `showAnswers` tweak that reveals a handwritten answer key), each a `.dc.html` built on the design system.
- `guidelines/`, foundation specimen cards (Colors, Type, Spacing, Brand) shown on the Design System tab.
- `social/`, social media templates (post, quote, story, carousel).
- `SKILL.md`, Agent-Skills-compatible entry so this system can be used in Claude Code.
- `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, **auto-generated**; do not edit.

---

## Caveats & how to help me make this perfect

This is a **complete first pass built from scratch**, so a few things are placeholders awaiting your input:

- **Fonts are Google-hosted substitutions** (Newsreader / Hanken Grotesk / Caveat / JetBrains Mono), not custom brand fonts. They load via CDN, so the manifest reports 0 self-hosted `@font-face` files. If HOMA has (or wants) bespoke fonts, send the files and I'll self-host them.
- **No logo → chosen: "A · The bright home."** A home with a spark of magic inside, homeschool + assistant in one glyph. It lives as the reusable **`Logo`** component (`components/brand/`), specced in `guidelines/brand-logo-lockup.card.html` (clear-space, size ramp, app icon, reversed), and is wired into the web app, mobile app, landing page, and social templates. Two earlier alternates (seedling, warm-morning) are preserved in `guidelines/brand-logo-directions.card.html`. The mark is drawn in CSS/SVG from geometry, if you'd like a hand-refined vector or a different color treatment, say so.
- **Imagery is placeholder slots.** Drop in real warm lifestyle photography to finalize the landing page and social posts.

**My ask of you:** 👉 **Does "Quiet warmth" feel premium enough now?** Tell me (a) if the clay/sage/gold palette is right or should shift warmer/cooler/brighter, (b) whether the serif-forward editorial direction lands, and (c) which surfaces to roll the premium pass into next (the web app dashboard and landing hero are the obvious next candidates). I'll iterate fast from there.
