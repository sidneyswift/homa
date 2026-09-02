# Making-wait feature cards (generated 2026-09-01)

Five real illustrations for the `making.tsx` wait screen, replacing generic
Lucide icons per explicit founder direction: "we can generate assets
instead of use icons... we need each screen to be as visually stunning as
Headspace." Same flat-graphic-design style validated in
`../paywall-hero-settings/MANIFEST.md`, generated with Higgsfield's
`nano_banana_pro`, square (1:1) aspect for card format rather than the
paywall set's portrait hero aspect.

Purpose: while the child's first page generates (~85s real floor, see
`first-making-latency` memory), a short card stack cycles through what
else Homa does, since real usage data showed families are never told
about planner/hours/progress/chat, they only ever see worksheets. This
also directly answers the founder's "don't just make her sit there"
direction (2026-09-01 conversation), replacing/supplementing the
checklist-only wait with something every session sees regardless of
whether real checklist questions remain for that child.

Copy for each card should reuse the already-approved lines in
`apps/web/components/marketing/landing-content.ts`
(`CAPABILITY_ITEMS` for plan/practice/binder/records,
`SAMPLE_REPORT_COPY` for progress), trimmed for a mobile card, plus one new
short line for chat. Do not write new feature descriptions from scratch
where an approved one already exists.

**Wired in and verified 2026-09-01**:
`apps/mobile/src/features/onboarding/making-feature-cards.tsx` (component)
+ `apps/mobile/src/app/(onboarding)/making.tsx` (integration). Images live
at `apps/mobile/assets/onboarding/making-feature-cards/` (400px, bundled
via `require()`, matching the existing brand-logo asset pattern). The
stack plays once per making session, before the checklist or the easel,
and is skipped immediately if the real page finishes before the cards do,
the real job always wins. Confirmed rendering live in the iOS Simulator
(temporarily lengthened the 3.4s-per-card interval to 60s to catch it
mid-cycle, then reverted). Typecheck and lint clean.

| File | Feature | Concept | Verdict |
|---|---|---|---|
| `plan.png` | Weekly plan (`CAPABILITY_ITEMS.plan`) | Week-at-a-glance calendar grid, a star and a checkmark, a pencil beside it | Ready |
| `practice-pages.png` | Practice pages (`CAPABILITY_ITEMS.practice`) | A tilted page with warm child-like doodle marks and a gold star sticker, evokes "her own marks" honesty pattern used elsewhere (MakingShow chip labels) | Ready |
| `progress.png` | Progress report (`SAMPLE_REPORT_COPY`) | A rising path of three milestone dots to a glowing star, encouragement rather than a clinical chart | Ready |
| `hours.png` | Teaching hours (`CAPABILITY_ITEMS.records`) | A clock face beside a checkmark ribbon/medal | Ready, minor note: the small rounded bars to the right of the ribbon read slightly UI-placeholder-ish; acceptable, but worth a second look before shipping if it reads that way at card size |
| `chat.png` | Web chat (no existing capability-item copy, needs one new short line) | Two overlapping speech bubbles, coral and cream, with a small sparkle | Ready |

## Prompt scaffold used

> A clean flat graphic-design illustration for a mobile app feature card,
> deliberately in between minimal geometric shapes and detailed painterly
> illustration: {scene}. Minimal shading, clean confident edges, warm
> coral (#E7602F), gold (#FFD43B), and cream accent colors, on a plain
> warm cream white (#F7F4EE) background. Not photorealistic, no 3D render,
> no people, no faces, no readable text, no UI elements, no buttons, no
> phone frame, a genuine small illustrated scene.

Same real Homa token values as the paywall set (coral `#E7602F`, gold
`#FFD43B`, cream `#F7F4EE`), confirmed against
`apps/mobile/src/theme/native-projection.ts` and
`apps/mobile/assets/brand/icon.svg`.
