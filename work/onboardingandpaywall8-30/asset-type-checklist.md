# Asset type checklist for onboarding + paywall

Across all 9 sources surveyed (Duolingo, MyFitnessPal, Flo, PictureThis,
ChatGPT, Facetune, Calm, Lingokids, and the 15-flow Mobbin cross-app pass),
three asset types show up almost everywhere: **plain, illustration-free
screens for demographic/transactional steps** (8/9 sources: MyFitnessPal,
Flo, PictureThis, ChatGPT, Facetune, Calm, Lingokids, Mobbin all strip art
from sign-up, age, gender, and OTP screens), **a themed icon set, one icon
per option or feature** (8/9, present in every source except PictureThis,
which substitutes badges and tables instead), and **a benefit
checklist/comparison table as recurring paywall UI chrome** (7/9,
independent of whatever hero art sits above it). Past that near-universal
core, the picture splits by category rather than staying uniform: **brand
mascot/character illustration** is the dominant device in kid-facing and
casual/wellness apps (Duolingo, Flo, Lingokids, and most of the Mobbin
onboarding query) but is explicitly and entirely absent from Calm, ChatGPT,
Facetune, and PictureThis: utility, beauty, and "serious" wellness apps
skip it outright. **Testimonial/review cards and star ratings** are common
in adult health/proof-driven apps (Flo, PictureThis, most of the Mobbin
paywall query) but Calm and Lingokids explicitly carry zero anywhere in
onboarding or paywall; Lingokids substitutes licensed-brand association
plus a safety-certification badge (KidSAFE COPPA) for the exact same trust
job an adult app would use a doctor photo or 5-star badge for. **Authority
badges** (trophies, "No.1" install-rank, editorial press badges) cluster in
PictureThis and the Mobbin paywall bucket. **Data charts/graphs** appear in
roughly half the sources (MyFitnessPal, Flo, PictureThis, Mobbin) and split
into two very different jobs: real data-comparison charts (PictureThis's
MSU-study bar chart) versus mood-graphic charts with no real numbers
(MyFitnessPal's stylized declining weight-loss line). **Autoplay video** is
the thinnest bucket: only Calm and Lingokids use it, both for a splash-
screen brand moment or a fast feature-tour trailer, suggesting it is an
emerging but not yet universal onboarding device.

## Asset types, ranked by how universal they are

| Asset type | Sources using it (of 9) | Typical art style(s) seen | Job it does |
| --- | --- | --- | --- |
| Empty state / plain text only (no illustrative asset) | 8/9: MyFitnessPal, Flo, PictureThis, ChatGPT, Facetune, Calm, Lingokids, Mobbin | Bare typography, native pickers/keyboards, plain checkbox or radio rows; zero icon, image, or color accent beyond one CTA color | Removes friction on demographic-capture and transactional steps (sign-up, age, gender, OTP): signals "this takes two seconds," defers persuasion to the screens around it |
| Themed icon set (small flat icons, one per option or feature) | 8/9: all except PictureThis | Flat, single- or few-color, line-art or filled; arranged in a row, grid, or vertical chip list | Lets a multi-option screen (goals, interests, feature recap, paywall plan differentiators) scan fast without reading paragraphs |
| Benefit checklist / feature-comparison table (paywall UI chrome) | 7/9: Duolingo, PictureThis, ChatGPT, Facetune, Calm, Lingokids, Mobbin | Checkmarks vs. dashes/locks, bulleted feature lines, plan-card rows; usually monochrome or single-accent-color | The one constant paywall element regardless of what hero art (or lack of it) sits above it: carries the actual sell via typography and comparison, not imagery |
| Photo-realistic lifestyle/editorial photography | 6/9: MyFitnessPal, Flo, PictureThis, Facetune, Calm, Mobbin | Genuine photography: candid lifestyle shots, macro/nature photography, editorial portraits, or authentic-looking UGC | Sells an emotional/aspirational outcome or supplies credibility (a real doctor, a real family); the dominant hero asset specifically on paywalls |
| Brand mascot/character illustration (persistent, reposed per screen) | 4/9 clearly (Duolingo, Flo, Lingokids, Mobbin's onboarding query is dominated by it: Finch, BitePal, Life Reset, Gentler Streak, Ahead, Alma), plus MyFitnessPal partially (one habit-education illustration, not a persistent character) | Flat vector, rounded, 2-3 solid colors, reused across many screens in different poses rather than a one-off image | Personifies the brand as a guide/narrator; explicitly and entirely absent from Calm, ChatGPT, Facetune, and PictureThis |
| Data chart/graph (real data or stylized mood-graphic) | 4/9: MyFitnessPal, Flo, PictureThis, Mobbin | Ranges from genuine bar/comparison charts (PictureThis) to purely illustrative mood-graphic curves with no real numbers (MyFitnessPal, Flo's hormone curve) | Dramatizes progress, a starting state, or a competitive claim; real-data and fabricated-mood-graphic versions look nearly identical, which is the exact risk to guard against |
| Authority badge / award graphic (trophy, laurel wreath, install-rank, safety cert) | 4/9: Flo, PictureThis, Lingokids, Mobbin | Flat vector laurel wreaths, glossy semi-3D trophies, editorial press-logo lockups, or a certification seal (KidSAFE) | Borrows outside credibility (a study, an install-rank stat, a safety certifier, an editorial "Editor's Choice") rather than manufacturing a user opinion |
| Hero product/device mockup (in-app UI framed in a bezel, or a feature preview composited onto a photo) | 4/9: Duolingo, Flo, Facetune, Mobbin | A simplified device-bezel outline around a mocked-up OS surface, a collage of small "app card" UI mockups, or a real feature screenshot overlaid onto a photo | Previews a concrete payoff (a widget, a dashboard, a tool) before asking the user to unlock it |
| Testimonial/review card (user quote + star rating, with or without an avatar) | 3/9: Flo, PictureThis, and the Mobbin paywall query (Citizen, Mindvalley, BitePal, Alma) | Rounded quote-bubble cards, initial-only or real-photo avatars, a star-rating badge | Social proof at the exact pre-paywall moment; explicitly absent in Calm and Lingokids, which is category-specific, not universal |
| Autoplay video / motion loop | 2/9: Calm, Lingokids | A gradient/typography-only hero loop, or a fast screen-capture-style trailer montage previewing the whole app | A splash-screen brand moment or a compressed "see the whole app in one clip" feature tour |
| Native OS system UI insert (the real permission dialog or native keyboard, not a custom asset) | 2/9 clearly: Duolingo, ChatGPT | An unstyled system alert or system-style sheet, sometimes with a hand-drawn annotation arrow pointing at a button | Primes a real OS ask (notifications, widgets) without pretending to be a custom-designed screen |

## Mapped to Homa's own screens

**hello.** No source in this research is a close category match for
"homeschool AI assistant," so treat this honestly as the weakest-evidence
mapping in this table. The two closest analogs both skip illustration
entirely: Flo's "Nice to meet you" greeting (screen 3) carries only its
small logomark, and Calm's two welcome screens ("take a deep breath,"
"Welcome!") run on gradient-plus-typography with zero imagery. Since Homa
has no mascot and the existing App Store thumbnails (per
`asset-inventory.md`) already establish a type-led visual system (warm
cream background, bold black display type, an orange gradient blob), the
honest recommendation is a **type-led, minimally-illustrated open**, not a
mascot-led one: closer to Flo/Calm's near-empty welcome than to
Duolingo's mascot-plus-speech-bubble open (which depends on a brand
character Homa doesn't have).

**intent (three-option goal picker).** This is the best-covered analog in
the whole set: it is structurally identical to Facetune's Editing Goals
screen (`05_EditingGoals`, a monochrome icon chip per option) and Calm's
Onboarding Goals screen (thin-stroke flat line icons, one per pill row).
Recommend a **themed icon set, one icon per intent option** (report/
progress, plan-the-week, keeping-hours), matching both apps' pattern of a
single-color line icon inline with the option label rather than a full
illustration.

**kids (per-child capture).** Demographic-capture screens are the single
most consistent "skip the asset" pattern in the research: Facetune's
Birth Year Picker (plain scroll wheel, one CTA color) and ChatGPT's Age
Confirmation (a small monochrome logo above a bare form) are the direct
analogs. Recommend keeping this an **empty-state/plain-text form**; the
research gives no evidence that adding icons here helps, and real weight
of evidence (8/9 sources) says the opposite.

**you (parent basics).** Same recommendation and same evidence as `kids`:
MyFitnessPal's Sign Up screen (plain white background, only small OAuth
logo marks) and Facetune's Gender Question (zero icon or image, just
type and outlined pill buttons) are the direct analogs.

**making (build + live questionnaire).** This is Homa's "personalizing"
beat, and two sources model it almost exactly: Facetune's Loading screen
(`06_Loading`, a whimsical flat-vector illustration literally dramatizing
"combining your answers") and Flo's Cycle Analysis Loading (screen 29, a
desaturated mascot orbited by small icons plus a "Powered by Flo
Intelligence" sparkle badge). Recommend a **flat vector illustration or
icon-collage loader** tied to the actual questionnaire content, but see
"What NOT to copy" below: `making`'s own existing law ("the interstitial
never claims work that is not happening") means the animation must track
what is genuinely being built, not imply more computation than is real,
which is a stricter bar than either Facetune or Flo actually holds itself
to.

**reveal (real worksheet).** Because this screen shows a real,
already-generated artifact, the honest analog is not an illustrated
"proof" screen at all: it's Duolingo's in-lesson quiz-correct moment
(screen 25: the real product working, with a small real celebration toast
overlaid) and MyFitnessPal's Today Dashboard (screen 21: the actual,
un-styled product screen standing in for a proof beat). Recommend pairing
the real worksheet with a **small, honest celebration UI element** (a
checkmark toast, not a chart or badge implying more than happened),
exactly the asset-inventory.md hard rule already states: this is the one
screen allowed to say "this is yours," everything else must say "example."

**next (three doors).** Structurally this is a late-flow benefits recap,
and the closest analogs are Duolingo's Benefits Overview (screen 20: three
rows, each a small colored icon + headline + subtext) and MyFitnessPal's
Feature Tools Pitch (screen 20: three circular icon badges, barcode,
mic, camera, each paired with one feature line), both placed roughly
two-thirds through their flows, after most personalization is already
collected. Recommend the same structure: **one themed icon per door**,
headline + one line of subtext, no illustration or photography.

**paywall.** This is where Homa's own laws most sharply cut against what
the research shows working elsewhere. The two most common paywall assets,
photo-real lifestyle photography (6/9 sources) and testimonial/review
cards (3/9, including Flo and PictureThis's star-rating badges), are both
largely unavailable to Homa: no photography budget or stock-photo plan is
established for this surface, and `homa-paywall-claims-laws` already rules
that Homa has zero paying customers, so every testimonial, star rating, or
"loved by N families" line is fabricated and legally exposed (FTC 16 CFR
465.2). What *is* available and matches both the research and Homa's own
prior ruling: a **benefit checklist** (7/9 sources, the most durable
paywall element regardless of hero art) built around the **real example
artifacts** already identified in `asset-inventory.md` (the worksheet,
report, and planner examples) standing in for the photography/proof slot,
closest in spirit to PictureThis's Accuracy Comparison screen, which
proves a claim with real data rather than a manufactured feeling. Layer in
the two honest substitutes `homa-paywall-claims-laws` already ranked
highest: billing-mechanics transparency (the charge-date sentence at body
weight, matching the ROSCA/CA-ARL requirement Facetune's Free Trial
Explainer timeline diagram also visualizes well) and the named real makers
line ("Alessa and Carolyng, two homeschooling mothers"), which the same
ruling's ten-persona panel found the single most persuasive sentence on
the page.

## What NOT to copy

Several asset types recur constantly in the research but would break an
existing Homa law if copied directly onto Homa's own paywall or
onboarding. Naming them here so nobody requests one by pattern-matching
against a competitor screenshot without checking first:

- **Fabricated testimonials, star ratings, or "loved by N families" lines**
  (Flo's paywall quote + 5-star row, PictureThis's Reviews Trust screen,
  the Mobbin paywall bucket's dominant pattern). Homa has zero paying
  customers; per `homa-paywall-claims-laws` every one of these is invented
  and both the FTC's fake-endorsement rule and plain honesty forbid it.
- **Authority badges implying an earned rank or award Homa hasn't earned**
  (PictureThis's "No.1 Installs" badge and MSU-certified trophy, Lingokids'
  Kidscreen Awards partner-logo lockup). Homa has no install-rank stat, no
  outside study, and no editorial "Editor's Choice"; do not invent a
  laurel-wreath or trophy graphic to imply one.
- **"Most popular" tags or scarcity/urgency badges without a real backing
  number** (MyFitnessPal's win-back "ENDS SOON" ticket, Calm's "Save
  61%/90%" tags, PictureThis's discount framing). `homa-paywall-claims-laws`
  already found "Most popular" live and unsupportable on a tier with no
  customers; the same reasoning bars any new scarcity graphic invented
  for a claim without a real number behind it.
- **Data charts or mood-graphics presented as if they describe the
  specific child** (Flo's hormone-curve chart annotated with mood emoji
  tied to "your body," MyFitnessPal's stylized declining weight-loss line
  with no real numbers). Homa's voice law is explicit (no red/"behind"
  framing about a child, never a verdict on a child), so any chart-style
  asset must either use the child's real data or not gesture at "this is
  about your kid" at all.
- **Fake "personalizing/analyzing" progress theater that outpaces what is
  actually computed** (Flo's Cycle Analysis Loading screen implies deep
  AI computation via a sparkle badge; Facetune's alchemy-flask loader
  dramatizes "combining your answers" during a screen the article notes is
  a *hard-coded wait*). Homa's own `making` screen already carries the
  opposite law (the interstitial never claims work that is not happening),
  so any loader asset built for `making` must track real computation,
  not borrow this pattern's dramatized-but-fake version of it.
- **A metering or tier-comparison claim not backed by real code** (the
  same `homa-paywall-claims-laws` finding that "adds five times the
  makings each week" was live and false because nothing reads
  `families.plan_tier` to meter anything). If a feature-comparison table
  asset (PictureThis's 19-row Plus/Pro table, ChatGPT's Free-vs-Plus
  table) is ever built for Homa's own tiers, every row must be checked
  against what the code actually enforces before it ships.

## Cross-reference

`asset-inventory.md` (same directory) catalogs the *specific* worksheet,
report, planner, binder, and hours-log assets already identified for
production: items 1 through 8 in its inventory table, several already
generated via the real materials-studio pipeline. This document is the
general *type* checklist one level up: use it to check that inventory for
completeness (are there asset **types** (a mascot, a chart, an authority
badge, a video loop) that keep appearing in the research but have no
corresponding row in the inventory yet?), and use the inventory for the
concrete, buildable list of what to actually produce next.
