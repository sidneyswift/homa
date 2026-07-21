# Mobile: stop the drift, then pass the web (PROPOSAL, 2026-07-20)

Status: proposed, awaiting founder review. Nothing here is implemented.
Founder decisions are marked D1 to D6. General mobile parity has no owning
ticket today: M1-17 is design-system integration and the mobile README
explicitly scopes it away from parity, so this plan is new scope and ships
nothing until ruled on.

## 1. Ground truth

Verified against this repo on 2026-07-20:

1. **Surface count.** Web has 12 parent-facing routes under `/app`
   (home, chat, planner, tasks, progress x2, report x2, binder, lessons
   x2, settings, kid profile). Mobile has 3 screens: home, chat, family
   (`apps/mobile/src/app/`). Onboarding, printables' print control, and
   everything else deep-link out to web.
2. **Renderer coverage.** Eve exposes 47 tools
   (`apps/web/agent/tools/`). Mobile chat renders output from 3 of them:
   `create_printable`, `show_material`, and the retired
   `create_worksheet` name (`apps/mobile/src/features/chat/message-view.tsx`,
   the `toolName ===` dispatch). Every other tool output falls through
   and renders nothing.
3. **The lag is structural, not accidental.** Web's renderer
   (`apps/web/app/app/message-parts.tsx`) also dispatches on hardcoded
   tool names, roughly 20 checks, but web's renderer and eve's tools live
   in one package and deploy atomically, so web can never fall behind.
   Mobile's renderer ships on a separate release cadence against the
   same live agent. Consequence: every capability added server side is
   instantly live on web and instantly invisible on mobile until someone
   edits `message-view.tsx` and cuts a release.
4. **The lag is already user-visible.** `open_planner` and `edit_plan`
   went live in prod with PR #61 (2026-07-20). Read from
   `message-view.tsx`, a parent who asks for the planner from the phone
   gets the tool call, the durable write, and no canvas: only Homa's
   text reply. Diagnosed from code, not yet reproduced on a device. If a
   device check confirms it mid-build, the prod-bugs ruling
   (`prod-bugs-fixed-not-stored`) applies to at least a minimal honest
   fallback, ahead of any ruling on the rest of this plan.
5. **Ship mechanics differ per fix.** JS-only changes (the renderer, new
   screens) ship over the air via the existing EAS Update workflow.
   Camera, push, and share-sheet ingest add native modules, so each
   needs a store build and submit, same as the Google sign-in work on
   branch `claude/reverent-colden-e7b904`.
6. **Tokens are hand-copied** into `src/theme/tokens.ts` per the
   standing rule; `packages/design` (M1-17) has not landed. Any new
   mobile surface multiplies the copies that must not drift.

## 2. The one structural fix: render by kind, not by name

The correction with the highest leverage is a contract change, not a
screen. Tools that produce something parent-visible add one typed field
to their result:

```ts
// packages/core, exact name and home per D1
type Renderable = {
  kind: "material" | "plan" | "task_list" | "progress" | "image" | "link";
  title: string;
  /** Opens the full experience; a web URL is always an acceptable target. */
  url?: string;
  /** One or two sentences in Homa's voice, safe to show verbatim. */
  summary?: string;
};
```

Clients dispatch on `kind`. Mobile renders the kinds it has native cards
for and falls back to a generic card (title, summary, open-on-web button)
for every kind it does not know. Silence stops being a possible outcome.

Why this placement is doctrine-clean: a rendering contract is an exact,
typed effect, which is tool-layer work under the placement ruling in
`15-agentic-architecture.md` §2. The judgment of what to say stays in
skills; the shape of what a client may draw becomes deterministic.

Consequences worth naming honestly:

- Web's renderer keeps its rich bespoke components; it can read
  `display.kind` where convenient but nothing forces a rewrite.
- The contract is additive to tool results, so it ships expand-contract:
  add the field, teach mobile to read it, never a breaking change.
- After this lands, a new tool of any known kind appears on mobile with
  zero mobile code, over the air. The derivative flips from negative to
  zero.

## 3. Past parity: what the phone can do that the web cannot

Porting all 12 screens buys a permanent maintenance tax and lands at
equal. The honest division of labor: web is the sit-down surface,
mobile is the in-the-moment surface. Four capabilities are
phone-native, and the server side of each already exists:

1. **Camera capture of finished work.** `ask_for_photo`, `keep_photo`,
   `search_photos`, `find_attachments` are live tools. On web a parent
   must move a photo to a computer first, so mostly they do not. On the
   phone they point it at the page. Feeds the materials review and
   progress evidence loops that already want reference photos
   (2026-07-19 audit). Needs `expo-image-picker` or `expo-camera`, a
   store build, and an upload path that pins to the family library.
2. **Push notifications.** Drip and nudges go by email and SMS today.
   Push lands where the parent already is, costs nothing per send, and
   the heads-up and follow-up tools already compose the content. Needs
   `expo-notifications`, APNs config, a token table keyed to the
   authenticated family mapping (a channel, per the channel doctrine),
   and consent UX.
3. **Native share and print for printables.** The README already names
   the gap. Small, JS plus one module.
4. **Share-sheet ingest.** A parent finds a curriculum or worksheet on
   their phone and shares it to Homa: the parent-facing twin of the
   Cosmo ingest flywheel, landing in the same reference-ingestion path.
   Largest of the four; needs a native share extension.

## 4. Explicit non-goals

Never ported: the 16 `/admin` routes, `/blog`, marketing pages, the
onboarding funnel (founder call 2026-07-08: one onboarding for every
door), and `/join`. These stay web, reached by deep link where mobile
needs them at all.

## 5. Proposed sequence

| Step | What | Ships via | Depends on |
|---|---|---|---|
| 1 | Renderable contract + mobile fallback card | OTA | D1 |
| 2 | Native task list + check-off (writes through plan-edits path) | OTA | D2 |
| 3 | Progress screen (read-only v1) | OTA | D2 |
| 4 | Camera capture wired to photo tools | store build | D3 |
| 5 | Push notifications | store build | D4 |
| 6 | Share/print polish, then share-sheet ingest | build | D3/D6 |

Steps 1 to 3 are pure JavaScript and reach installed phones over the
air. Steps 4 and 5 can share one store build with the Google sign-in
native change if timing aligns.

## 6. Founder decisions

- **D1 (contract).** Adopt the renderable-descriptor contract at the
  tool layer, yes or no, and its home (`packages/core` vs
  `apps/web/agent`). This is the load-bearing decision; everything in
  §5 step 1 hangs on it.
- **D2 (surfaces).** Which parent surfaces earn native screens in v1:
  proposal says tasks and progress only, planner stays chat-plus-web
  for now, binder and lessons stay web.
- **D3 (camera).** Confirm camera capture as the first native
  investment after sign-in, and whether v1 is capture-to-chat only
  (photo arrives as an attachment Homa can see) or also
  capture-to-binder.
- **D4 (push).** Approve push as a channel, including policy: which
  nudges may use it, quiet hours, and whether SMS remains the fallback
  for linked phones.
- **D5 (design package).** Whether M1-17's `packages/design` must land
  before steps 2 and 3 add screens, or hand-copied tokens remain
  acceptable through this phase.
- **D6 (Android).** Whether Android stays explicitly deferred. Today
  updates publish iOS-only and the OAuth callback behavior on Android
  is untested; saying so out loud keeps the boundary honest.

## 7. What this plan does not claim

No device-level verification has happened for item §1.4; it is a code
read. No effort estimates here are commitments. The Google sign-in work
is a separate in-flight branch and merges on its own schedule
regardless of these rulings.
