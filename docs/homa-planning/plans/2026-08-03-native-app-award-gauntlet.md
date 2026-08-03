# Homa native app award gauntlet, current reconciliation

**Date:** 2026-08-03
**Status:** Evidence-backed product audit and release program
**Scope:** Native mobile experience for a homeschooling parent, with the mom lens requested by the founder and an authorized-caregiver privacy boundary
**Parent issue:** [gh#299](https://github.com/sidneyswift/homa/issues/299)
**Related program spec:** [2026-08-02 Homa interface modernization](./2026-08-02-homa-interface-modernization.md)

## Executive verdict

Homa has the ingredients of an award-caliber product: a distinctive Voice-first entry, a calm family-safe visual language, real planner and progress state, generated materials that can leave the screen, and a backend that can keep durable family truth separate from conversation. The native app is not yet an award-caliber product because those capabilities do not yet feel like one closed loop.

The product promise to optimize is:

> A parent can say one ordinary sentence in the middle of family life, see the right context, approve the smallest useful next move, and end with the right action, artifact, or record without managing Homa.

The current no-ship issues are not primarily missing screens. They are trust and continuity failures:

- The native first-use setup path now exists, but its production migration, privilege probe, and physical first-win proof are still open.
- There is no single Today surface that answers what matters now.
- A Voice request can promise “keep listening,” while the next surface appears muted or incomplete.
- Planner, Progress, Binder, and Voice do not yet share a fully legible active-object and state contract.
- Physical-device spoken-turn, interruption, print, share, and accessibility proof is incomplete.
- A confirmed production privacy issue can expose one adult's raw conversation to another adult. Growth work waits behind [gh#606](https://github.com/sidneyswift/homa/issues/606) and the unanswered restore rule.

The award standard is therefore a measured closed loop, not a feature count.

## Evidence and confidence

### Observed or verified

- Native route and feature inventory under `apps/mobile/src/`.
- Xcode 26.6 iOS 18.6 simulator build from this branch installed and rendered the current native sign-in surface. This proves bundle and shell rendering only, not an authenticated setup, first useful outcome, or physical-device behavior.
- Native package boundary in [`apps/mobile/README.md`](../../../apps/mobile/README.md).
- Existing launch research in [`docs/homa-planning/plans/2026-07-28-ios-launch-evidence/`](../2026-07-28-ios-launch-evidence/).
- Voice shell direction screenshots in [`docs/homa-planning/plans/2026-08-01-voice-shell-direction-lab/`](2026-08-01-voice-shell-direction-lab/).
- Read-only UX review of the three screenshots by an independent subagent using [`homa-uxui-reviewer`](../../../.agents/skills/homa-uxui-reviewer/SKILL.md).
- Production planner release after PR #759: Vercel alias `thankshoma.com` is Ready, `/` returns 200, `/app/planner` returns the expected 307 auth redirect, main CI is green, and the mobile OTA workflow is green.
- Main head after merge: `3ca8a606c74e9037e69a79ae06ffb6d2f931c95d`.
- Native Planner scheduling now has one instrumented capture-to-effect slice in [PR #764](https://github.com/sidneyswift/homa/pull/764): the server owns the schedule receipt binding, the client awaits the best-effort pre-effect telemetry emission before the mutation, and restart recovery plus duplicate receipt claims are covered by deterministic and disposable PostgreSQL tests. GitHub CI run [30792411407](https://github.com/sidneyswift/homa/actions/runs/30792411407) and its Vercel preview passed for commit `e3390652`. This proves the no-false-outcome boundary, not durable telemetry delivery or a physical-device journey.
- The native first-use branch now creates a family, adds a learner, and completes the canonical profile flag through receipt-checked RPCs with a stable child idempotency key. Contract tests cover the client and migration shape, but the migration has not been applied or privilege-probed in production.
- Native Chat restore now has bounded server-binding attempts, explicit auth and timeout recovery, and an invalid-time-zone fallback instead of an indefinite spinner. The mobile planner suite reports 63 passing tests on this branch.
- The accessibility guard now passes its static registry, node tests, isolated runner typecheck, and 31 rendered Jest tests under Node 23.6.1. The runtime manifest load is intentionally compatible with both direct `tsx` execution and `node:test` CommonJS loading.
- Voice connection now has a bounded abort-aware startup, explicit connecting cancellation, late-stream cleanup, and callback guards against timed-out attempts. This is source and contract evidence, not a spoken-turn device proof.
- Family data now has one session-aware provider at the authenticated root, so Settings and every tab share the same family snapshot instead of issuing route-specific reads. A bootstrap contract test protects that route boundary.
- The shared family provider is keyed by authenticated user, BillingGate by user plus family, and Voice active objects carry an owner user ID. This closes the cross-account stale-state window in source and contract review, but still needs an adversarial device and production probe.

### Not yet proven

- A physical iPhone spoken turn with capture, transport, model response, playback, interruption, and recovery.
- Native VoiceOver, largest Dynamic Type, weak-network, phone-call, audio-route, and background/foreground journeys on a release build.
- A fresh-family install-to-first-use journey completed on a release build without leaving native. The native setup path is implemented, but [gh#304](https://github.com/sidneyswift/homa/issues/304) remains open until production migration, auth handoff, and first useful outcome are proven.
- Five-mom comprehension and outcome study.
- Production tenant-isolation and RPC privilege verification. The local isolation guard could not run because this worktree has no `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- The native web fallback is not an authenticated handoff. Native Supabase sessions persist in AsyncStorage, while web SSR reads cookies, and `openWebOnboarding()` sends only `/onboarding`. A direct link can therefore create a separate anonymous web setup or send the parent to sign-in. A true bridge needs a one-use server exchange or an explicit re-authentication step, plus a founder and security ruling. Access or refresh tokens must not be placed in a URL.

The Voice screenshots are useful interaction evidence, but they are a React Native Web prototype with fake family data and an explicit “No product actions” strip. They are not simulator or production proof.

## The closed-loop product model

Every high-value native journey should make this sequence visible:

1. **Notice:** Homa or the parent identifies a real family need.
2. **Capture:** Voice, text, camera, file, or one tap captures it with the correct child and family context.
3. **Propose:** Homa offers one small, grounded next move and shows the evidence or source used.
4. **Review:** The parent can see the exact object, wording, date, destination, and scope.
5. **Commit:** Durable, external, financial, access, legal, or destructive effects receive one last responsible confirmation.
6. **Complete:** Homa reports the deterministic result, not an intention or model claim.
7. **Reuse:** The result is findable in Today, Planner, Binder, Progress, or the relevant record surface.
8. **Return:** The next visit has a real reason, such as a finished material, a prepared day, a conflict to resolve, or a brief reflection.

The parent can stop, defer, replace, or drop work. None of those dispositions is a moral score.

## What a mom wants Homa to do, and the UX bar for each job

The tables below are the complete parent job map for the current product ambition. “Strong” means a meaningful implementation exists, not that the final journey has passed its release gate.

### 1. Run today's homeschool day

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Know what matters now | Open to at most three proposed priorities, why each appeared, and one obvious next action. Parent can reorder or dismiss. | Missing, tracked by [gh#303](https://github.com/sidneyswift/homa/issues/303) |
| Start the day | One tap or one sentence starts the prepared rhythm, with the first activity and supplies visible. | Missing |
| Salvage ten minutes | Offer a low-prep reset or off-screen activity without opening a planning workflow. | Missing |
| See each child | Fast child switch, child identity on every row, no sibling ranking or comparison. | Partial |
| Coordinate two children | Show simultaneous needs without declaring one child more important. | Missing |
| Check off real work | Reachable control, immediate result, undo, idempotent write, and no double tap ambiguity. | Strong, retain the released stale-safe schedule contract |
| Move unfinished work | Voice or tap moves one item, shows the destination, and offers undo. | Partial |
| Finish without debt | “Done,” “defer,” “replace,” and “drop” are all explicit and emotionally neutral. | Missing |
| Recover from a changed day | A change previews the affected plan only and leaves unrelated work untouched. | Partial |
| See the whole week | The week view shows all days or plainly says later days are empty. No blank space that looks like loading. | UX gate found a failure in the prototype |
| Look ahead one month | Load, conflicts, open decisions, and reusable anchors appear before detail. | Partial |
| Keep recurring rhythms | Reuse routines with visible exceptions instead of rebuilding each week. | Partial |
| Export selected events | Exact event preview, narrow permission at use, per-event result, truthful completion. | Strong, physical proof still needed |

### 2. Ask for help while hands are busy

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Talk naturally | Voice is the default entry, starts predictably, and makes listening state unmistakable. | Partial, bounded startup and cancellation are implemented; device proof remains |
| Switch voice and typing | One conversation, one history, one active object across modes. | Partial |
| Ask “what about this?” | “This” resolves to a server-validated visible object or Homa asks the parent to select it. | Partial, [gh#536](https://github.com/sidneyswift/homa/issues/536) |
| Navigate while talking | Planner, Binder, Progress, Hours, and Tasks open without ending or duplicating Voice. | Partial, [gh#535](https://github.com/sidneyswift/homa/issues/535) |
| Know whether Homa is listening | A labeled or highly legible state, not a tiny dot or crossed-out mic that needs inference. | UX gate found a failure; connecting now has explicit Cancel connection |
| Interrupt Homa | One reachable stop action works immediately and preserves the parent's words. | Partial |
| Know what was heard | Compact transcript, correction path, and clear adult-private visibility. | Partial |
| Capture now, organize later | One sentence creates a labeled inbox item without forcing a destination choice. | Missing |
| See long work progress | Phase, honest expectation, safe leave, cancel, resume, and destination. | Partial |
| Recover after signal loss | Preserve draft and object identity, explain what was sent, and provide one retry. | Partial, [gh#621](https://github.com/sidneyswift/homa/issues/621) |
| Undo an accidental action | Receipt names the exact effect and compensates only when the action is reversible and unambiguous. | Strong |
| Never fake activity | Stream, consent, auth, and provider failures produce a clear state, not a spinner that looks alive. | Partial |

### 3. Make work that leaves the screen

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Make a lesson or worksheet | First draft is child- and goal-relevant, visible quickly, and editable. | Partial |
| Make it fit a child | Show what changed and which evidence was used, never an age-gap verdict. | Partial |
| Make a sibling version | Reuse lineage and adapt load without comparing siblings. | Partial |
| Revise naturally | “Shorten this” or “make it gentler” creates a new reviewable version, never silent finalization. | Strong |
| Approve without internal nouns | Keep, change, print, share, and earlier version use ordinary parent language. | Partial |
| Print the right version | Preview exact pages and copies, use the native sheet, report only the system result. | Partial, [gh#538](https://github.com/sidneyswift/homa/issues/538) |
| Share from the parent's app | Native share sheet, editable note, explicit sender identity, no inferred delivery. | Partial, [gh#546](https://github.com/sidneyswift/homa/issues/546) |
| Find it later | Search by child, subject, kind, date, and source, with recent work leading. | Partial, [gh#530](https://github.com/sidneyswift/homa/issues/530) |
| Reopen unfinished work | Draft, in-progress, and final states are distinct and each has one next action. | Partial |
| Use a workbook or PDF | Preserve source pages and show adaptations before scheduling. | Partial |
| Upload family resources | Honest progress, recovery, private storage, original download, and source link. | Partial |
| Prepare supplies | Group editable supplies from approved work, with “already have” and “skip” choices. | Missing |
| Make learning playful | Offer puzzles, stories, hunts, and observations when they fit the goal and reference style. | Partial |
| Keep school off-screen | Measure whether outputs create print, movement, conversation, or observation, not just more screen time. | Partial |

### 4. Notice learning without judging a child

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Capture what happened | Voice, text, photo, or recording proposes an observation for confirmation. | Partial |
| See recent evidence | Lead with dated quote, work sample, or observed behavior, source, and freshness. | Partial, [gh#623](https://github.com/sidneyswift/homa/issues/623) |
| Know what to try next | Every insight ends with one small relevant next move. | Missing |
| Understand confidence | Observed, inferred, conflicting, and unknown are named in words. | Missing |
| See change over time | Sparse dated milestones, changing support, and parent-selected next moves. | Partial |
| Resolve conflicts | Show both pieces and ask, never silently average. | Missing |
| Celebrate a first | Save parent-controlled firsts without points, streak debt, or sibling comparison. | Missing |
| Prepare an evaluator brief | Privacy preview, exact evidence, source dates, and parent review before share. | Partial, [gh#624](https://github.com/sidneyswift/homa/issues/624) |
| Correct memory | Show what Homa saved, who can see it, why it matters, and how to undo. | Partial |

### 5. Keep records without becoming a clerk

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Log hours quickly | Voice or one-tap reuse with exact child, subject, date, and duration visible. | Partial |
| Correct a record | Edit or delete with before and after, plus undo where safe. | Strong |
| See requirement progress | Target, completed amount, remaining amount, source date, and freshness. | Partial |
| Explain an unusual day | Optional short note, never a form wall. | Partial |
| Produce a state packet | Included records, blanks, sources, last verified date, download, print, and share. Homa prepares, parent files. | Partial |
| Export family records | Exact scope, format, progress, and completion receipt. | Missing |
| Keep records after cancellation | Readable history follows approved entitlement policy. | Blocked by founder decision |

### 6. Let Homa help before being asked

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Receive a morning brief | Only after warm use, with today, supplies, and one watch item. | Partial |
| Know when a long job finishes | Delivery receipt deep-links to the exact result. | Missing, [gh#307](https://github.com/sidneyswift/homa/issues/307) |
| Get a weekly reflection | Short, child-specific, optional, and easy to turn off. | Blocked by [gh#401](https://github.com/sidneyswift/homa/issues/401) |
| Run a recurring task | Plain schedule, next run, pause, run now, and history. | Strong |
| Understand a suggestion | Explain why now, what Homa used, and how to dismiss or tune it. | Missing |
| Control channels | One place for push, email, SMS, quiet hours, and frequency. | Missing |
| Recover a missed rhythm | Offer the smallest useful action, never guilt or punitive streak language. | Missing |

### 7. Coordinate family and trusted helpers

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Invite another adult | Shared versus private scope is plain before invite; pending, accepted, expired, and revoked are visible. | Partial, [gh#629](https://github.com/sidneyswift/homa/issues/629) |
| Know who sees what | Privacy ledger by adult and data class. | Missing |
| Keep raw conversation private | Adult's raw chat, voice, calls, attachments, and evidence stay private. | Production blocker, [gh#606](https://github.com/sidneyswift/homa/issues/606) |
| Share approved family state | Planner, final materials, tasks, and selected progress can be shared without raw transcript. | Partial |
| Revoke access safely | Future access effect is explicit; private-history restore is a separate ruling and flow. | Blocked by founder decision |
| Hand off the day | Done, changed, and needs-you summary in under a minute. | Missing, [gh#626](https://github.com/sidneyswift/homa/issues/626) |
| Give a helper one thing | Scoped artifact or request with expiry and revocation, not full family membership. | Missing |
| Recommend Homa | Prompt only after a verified positive outcome, with generic copy and no family data. | Partial, [gh#628](https://github.com/sidneyswift/homa/issues/628) |

### 8. Manage trust and the product itself

| Mom job | Award-level UX expectation | Current posture |
|---|---|---|
| Sign in as expected | Apple, Google, and email paths explain what happens next and return to the app. | Partial |
| Recover a password | Native entry, working link, safe landing, and return to the intended state. | Missing, [gh#327](https://github.com/sidneyswift/homa/issues/327) |
| Finish setup natively | Account, family, child, first request, first result, and plan choice stay coherent. | Partial, receipt-bound family and learner setup is implemented; [gh#304](https://github.com/sidneyswift/homa/issues/304) remains open for production and device proof |
| Understand price | One Monthly or Annual choice, truthful terms, restore visible, no surprise gate. | Partial |
| Restore purchase | Progress, result, and next action when no purchase is found. | Partial |
| Set AI consent | Plain third-party processing explanation, current choice, retry, and reversible Settings control. | Partial |
| Export or delete data | Exact inventory, strong confirmation, progress, and receipt. | Partial |
| Use accessibility settings | Same outcome through VoiceOver, large text, contrast, reduced motion, and one-handed reach. | Partial, [gh#633](https://github.com/sidneyswift/homa/issues/633) |
| Use weak connectivity | Read safe cached state, queue only approved idempotent intent, explain what waits. | Missing, [gh#621](https://github.com/sidneyswift/homa/issues/621) |
| Correct a family assumption | Inspectable memory, correction, affected surfaces, and undo. | Missing |
| Set family boundaries once | Conversational setup summarized as an editable family brief. | Partial |
| Use it across devices | iPhone first, with iPad and orientation support only when genuinely adapted. | Partial |

## Universal mobile state contract

Every ticket must specify these states before implementation is considered complete:

| State | Required behavior |
|---|---|
| Entry | Parent predicts what happens before acting. |
| Permission prime | Immediate benefit and narrowest scope precede the system prompt. |
| Loading | Name the work and preserve useful prior state. |
| Working | Show phase, honest expectation, and safe Stop or Leave. |
| Review | Show exact child, object, date, source, destination, and proposed effect. |
| Commitment | Confirm once immediately before durable, external, financial, access, legal, or destructive effect. |
| Success | Say what happened, where it lives, and the one likely next action. |
| Undo | Reverse the latest safe effect or ask when ambiguous. |
| Empty | Explain the value, show a believable example, and offer one creation action. |
| No results | Preserve query and filter; explain how to broaden. |
| Error | Say what did not happen, what remains safe, and one recovery action. |
| Offline | Separate cached state, queued safe intent, and actions requiring connection. |
| Interrupted | Preserve draft and object identity across backgrounding, calls, audio routes, and auth expiry. |
| Entitlement | Explain the boundary at the useful action, preserve work, and show restore. |
| Accessibility | Announce changes once, preserve semantic order, support large text, and never rely on color alone. |
| Privacy | Name whether input and output are adult-private, family-shared, scoped-shared, or leaving Homa. |

## Category leader research and what Homa should borrow

These are product facts from official sources, followed by Homa-specific inferences. The inferences require Homa testing.

| Leader | Verified behavior | Homa principle |
|---|---|---|
| [Duolingo](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/) | Selects a next lesson, uses streak flexibility, reminders, practice modes, and optional friends features. | Give a family one obvious next action and a forgiving rhythm. Never copy guilt, ranking, or streak debt. |
| [Duolingo Friend Streak](https://blog.duolingo.com/friend-streak/) | Shared commitment and nudges improve return behavior, according to Duolingo's own product evidence. | Test optional caregiver accountability only after a parent-chosen outcome. It cannot be a requirement for a complete single-caregiver journey. |
| [Photomath](https://photomath.com/) | Camera scan, editable capture, step-by-step explanation, and multiple methods. | Treat camera or file extraction as an editable proposal with visible source, never as silent truth. |
| [Brilliant](https://brilliant.org/faq/) | Interactive problem solving, short lessons, adaptive paths, and low-energy practice. | Make parent actions compact and interactive instead of replacing them with long instruction. |
| [Khan Academy mastery](https://support.khanacademy.org/hc/en-us/articles/115002552631-What-are-Course-and-Unit-Mastery-) | Progress is tracked across devices and skills move through familiar, proficient, and mastered states. | Use dated evidence, confidence, and one parent-selected next move instead of a dense score dashboard. |
| [Khanmigo family roles](https://support.khanacademy.org/hc/en-us/articles/13982227159437-How-do-I-sign-up-for-Khanmigo) | Parent, learner, and teacher roles are explicit, with plan and eligibility boundaries. | Make adult roles, privacy, and plan state legible during onboarding, not hidden in Settings. |
| [Quizlet AI study tools](https://quizlet.com/features/ai-study-tools) | Notes and PDFs become editable study guides, tests, and flashcards. | Preserve source links and let the parent edit the generated object before it becomes family truth. |
| [ChatGPT Projects](https://help.openai.com/en/articles/10169521-chatgpt-projects) | Scoped files, instructions, memory, chats, and tools continue across web and mobile. | Keep family context and active objects continuous across surfaces, while separating adult-private source conversations. |
| [ChatGPT Tasks](https://help.openai.com/en/articles/10291617-tasks-inchatgpt) | Scheduled work can notify across platforms and asks for notification permission on mobile. | Ask for push only after a value moment, and make each notification a delivery receipt or useful offer. |
| [ChatGPT Study Mode](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq) | Step-by-step questions, understanding checks, voice or dictation, review notes, and adjustable difficulty. | Homa should guide a parent to a next action without taking over judgment or pretending certainty. |
| [Claude Artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts) | Persistent editable outputs have versions and can be shared or remixed. | Every material, plan, and evidence brief needs a stable object, version, source, and next action. |
| [Claude Projects](https://support.anthropic.com/en/articles/9517075-what-are-projects) | Scoped knowledge bases and instructions reduce context hunting. | Make family context inspectable and scoped, not a hidden prompt. |
| [Perplexity Projects](https://www.perplexity.ai/help-center/en/articles/10352961-what-are-spaces) | Files, instructions, memories, sharing, and connectors are scoped to a private workspace. | Collaboration should be object-scoped and optional, with revocation and privacy preview. |
| [Perplexity source model](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work) | Answers expose sources and explain search-backed synthesis. | Plans and progress explanations should expose evidence and freshness, not only confidence styling. |
| [Gemini Live and Canvas](https://blog.google/products-and-platforms/products/gemini/gemini-app-updates-io-2025/) | Camera or screen context, voice, Canvas editing, and connected tasks keep work in flow. | Let Voice and the visible object share one session, but require explicit capture and privacy state. |
| [Apple 2026 Design Awards](https://www.apple.com/in/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/) | Apple emphasizes delight, inclusivity, innovation, interaction, social impact, and visual craft. | One distinctive interaction, strong hierarchy, and equal outcomes for accessibility beat a larger feature list. |

### What the leaders do not license Homa to copy

- No leaderboard, child comparison, shame, streak loss, or variable-reward pressure.
- No generic chatbot as the primary information architecture.
- No hidden source loss when converting a worksheet, PDF, photo, or memory into a plan.
- No default adult access to raw conversations.
- No notification prompt before the parent has a result worth protecting.

## UX/UI gate from the voice-shell prototype

The one-pass screenshot review found warmth and comprehension on the individual screens, but a continuity failure across them:

1. Voice clearly communicates “talk to Homa,” and the calm character feels like a helper rather than a gradebook.
2. The week view is readable through Wednesday, but the blank lower area makes Thursday through Sunday look missing, still loading, or below the fold.
3. Planner loses a strong Homa or current-surface anchor, so the parent has to remember how to reach Binder.
4. Binder is easy to scan and has good child labels, but the small helper text creates rereading.
5. “Keep listening” is contradicted by Binder's “Muted” dock. A tiny mic and dot do not make the state legible enough for one-thumb use.

The highest-leverage design changes are:

- One shell-owned Voice state with a labeled, 44-point control and a visible state transition when another feature owns the microphone.
- A week view that answers the complete requested week, including explicit empty days or a clear continuation affordance.
- A persistent current-surface and Homa anchor in Planner and Binder.
- One dominant next action per surface, with helper copy readable at normal phone distance.
- The yellow prototype strip disappears from production and is replaced by truthful empty, loading, and unavailable states.

## Unknowns and blindspot cards

This pass follows [`finding-unknowns`](../../../.agents/skills/finding-unknowns/SKILL.md): distinguish what sounds plausible from what a parent will actually encounter, classify the blindspot, explain the harm, and specify the next evidence.

| Blindspot class | Unknown | Why it bites | Evidence or decision needed |
|---|---|---|---|
| Landmine | “Keep listening” can become muted after navigation. | A parent stops trusting the most differentiated promise and may speak into a dead session. | Physical-device Voice shell test with audio route, background, and navigation transitions. |
| Landmine | A week view can look partially loaded when later days are empty. | Parent cannot tell whether Homa lost work or the week is genuinely sparse. | Fixture with empty and populated later days, plus five-mom comprehension. |
| Landmine | A fresh OAuth user can have no family. | The first action is recovery work instead of a first win. | Fresh-install matrix for Apple, Google, and email, including interrupted callback. |
| Landmine | Adult raw history can cross an access-grant boundary. | One privacy crossover destroys trust and is a production P0. | [gh#606](https://github.com/sidneyswift/homa/issues/606), adversarial fixture, founder restore ruling. |
| Unwritten convention | Moms expect a visible Homa and current-surface anchor. | A familiar face disappears between routes and makes a correct screen feel like another product. | Prototype comparison with persistent shell and five-second surface naming task. |
| Unwritten convention | Native system handoffs report their own result. | “Printed” or “sent” before iOS confirms creates false completion. | Physical print and share destination receipts. |
| Unwritten convention | Permission is requested when its value is obvious. | First-launch push or calendar access feels like extraction. | Permission-prime experiment after first artifact or selected export. |
| Missing concept | Today is the family re-entry point. | Without it, every return starts with navigation and memory of what changed. | [gh#303](https://github.com/sidneyswift/homa/issues/303), activation and D7 loop metrics. |
| Missing concept | Active object is shared across Voice, Planner, Binder, and Progress. | “This” becomes a model guess and a wrong-child risk. | [gh#536](https://github.com/sidneyswift/homa/issues/536), server receipt and stale-object tests. |
| Missing concept | Parent needs evidence plus one next move, not a score. | Progress can be accurate yet emotionally and practically unhelpful. | [gh#623](https://github.com/sidneyswift/homa/issues/623), sparse and conflicting fixtures. |
| Missing concept | Collaboration has three access levels: private source, family state, scoped share. | A generic invite either exposes too much or adds no value. | [gh#629](https://github.com/sidneyswift/homa/issues/629), [gh#626](https://github.com/sidneyswift/homa/issues/626), founder privacy ruling. |
| History | Existing issue #299 still describes a three-screen skeleton. | Stale tracker language can make shipped capability and proof gaps indistinguishable. | Comment and link this reconciliation; do not rewrite historical evidence as shipped proof. |
| History | Planner stale-write fixes are shipped, but not every route has a fresh physical-device evidence record. | A safe backend contract can still be hidden by a weak native journey. | Main CI, production probe, and device packet under [gh#726](https://github.com/sidneyswift/homa/issues/726). |

### Explicit stop point for future research

Do not expand the feature list until each active epic has:

1. One parent job and one measurable outcome.
2. A complete state contract.
3. A known owner and existing issue or a justified new issue.
4. An evidence plan that distinguishes simulator, device, production, and study proof.
5. A kill rule for a value, trust, or fatigue failure.

## Epic and child-ticket architecture

The live tracker already contains the correct ownership boundaries. The table below is the award program's category map, not a second issue system.

| Epic | Parent issue | Child tickets and purpose |
|---|---:|---|
| Release truth, accessibility, and physical-device proof | [#299](https://github.com/sidneyswift/homa/issues/299) | [#620](https://github.com/sidneyswift/homa/issues/620) spoken turn; [#633](https://github.com/sidneyswift/homa/issues/633) accessibility; [#632](https://github.com/sidneyswift/homa/issues/632) performance; [#726](https://github.com/sidneyswift/homa/issues/726) installed-device evidence; [#634](https://github.com/sidneyswift/homa/issues/634) five-mom study |
| First family win, identity, and demand test | [#299](https://github.com/sidneyswift/homa/issues/299) | [#304](https://github.com/sidneyswift/homa/issues/304) native onboarding; [#684](https://github.com/sidneyswift/homa/issues/684) auth, onboarding, paywall, and handoffs; [#327](https://github.com/sidneyswift/homa/issues/327) reset; [#305](https://github.com/sidneyswift/homa/issues/305) StoreKit |
| Today and one-thumb re-entry | [#303](https://github.com/sidneyswift/homa/issues/303) | [#674](https://github.com/sidneyswift/homa/issues/674) one Planner; [#263](https://github.com/sidneyswift/homa/issues/263) native board; [#259](https://github.com/sidneyswift/homa/issues/259) write parity; [#750](https://github.com/sidneyswift/homa/issues/750) conversation checkpoints; deep-link route work in #303 |
| Voice-owned shell and active-object continuity | [#534](https://github.com/sidneyswift/homa/issues/534) | [#535](https://github.com/sidneyswift/homa/issues/535) persistent shell; [#536](https://github.com/sidneyswift/homa/issues/536) active object; [#538](https://github.com/sidneyswift/homa/issues/538) print; [#540](https://github.com/sidneyswift/homa/issues/540) recorder; [#541](https://github.com/sidneyswift/homa/issues/541) photo; [#545](https://github.com/sidneyswift/homa/issues/545) calendar; [#546](https://github.com/sidneyswift/homa/issues/546) share |
| Evidence-first Progress and truthful records | [#617](https://github.com/sidneyswift/homa/issues/617) | [#623](https://github.com/sidneyswift/homa/issues/623) evidence and next move; [#624](https://github.com/sidneyswift/homa/issues/624) evaluator brief; [#675](https://github.com/sidneyswift/homa/issues/675) workspace grammar; [#697](https://github.com/sidneyswift/homa/issues/697) accessibility and performance |
| Materials and Binder flywheel | [#530](https://github.com/sidneyswift/homa/issues/530) | [#531](https://github.com/sidneyswift/homa/issues/531) revision lineage; [#359](https://github.com/sidneyswift/homa/issues/359) materials trust; [#687](https://github.com/sidneyswift/homa/issues/687) generated materials and print; [#616](https://github.com/sidneyswift/homa/issues/616) source recovery |
| Proactive help and consented retention | [#307](https://github.com/sidneyswift/homa/issues/307) | [#688](https://github.com/sidneyswift/homa/issues/688) future push identity; [#401](https://github.com/sidneyswift/homa/issues/401) weekly check-in; [#400](https://github.com/sidneyswift/homa/issues/400) parent voice preference; [#203](https://github.com/sidneyswift/homa/issues/203) long-turn progress |
| Optional family collaboration and word of mouth | New work is already split into children | [#629](https://github.com/sidneyswift/homa/issues/629) adult access; [#626](https://github.com/sidneyswift/homa/issues/626) handoff queue; [#628](https://github.com/sidneyswift/homa/issues/628) outcome-earned referral; [#624](https://github.com/sidneyswift/homa/issues/624) scoped evidence brief |
| Privacy and access foundation | Direct release gate | [#606](https://github.com/sidneyswift/homa/issues/606) raw conversation isolation; [#607](https://github.com/sidneyswift/homa/issues/607) access revoke; [#618](https://github.com/sidneyswift/homa/issues/618) adult identity and access semantics. These remain blocked by the founder restore decision. |

### Ticket rule

No new ticket should be filed for a feature already owned by this map. A new ticket is justified only when it has a distinct parent job, effect, owner, and evidence boundary. Existing issues remain the live tracker; this document is the product and evidence layer.

## Gauntlet loops

Every epic runs these loops in order. A passing unit test or screenshot is not a passing journey.

### Loop 1: comprehension

- After five seconds, can a mom say what the surface is for?
- Is one primary action obvious without a command cheat sheet?
- Can she predict what Homa will save, send, print, schedule, or remember?
- Does the current surface and Homa identity remain anchored?

**Pass:** four of five diagnostic participants complete the primary outcome without moderator rescue, and all five can explain the effect.

### Loop 2: value

- Does the journey reduce preparation, coordination, uncertainty, or clerical work?
- Does it produce an outcome that leaves the screen or improves the next real decision?
- Would removing it damage the closed loop?

**Pass:** a measured outcome improves against the family's existing method, with a predeclared minimum effect and no trust regression.

### Loop 3: state and resilience

Run entry, permission prime, loading, working, review, commitment, success, undo, empty, no results, error, offline, interrupted, entitlement, accessibility, and privacy states. Interrupt with backgrounding, a phone call, audio-route change, duplicate tap, expired auth, weak network, and a newer server revision.

**Pass:** useful prior state remains visible, no effect is falsely claimed, and recovery is one clear action.

### Loop 4: trust and privacy

- Two adults in one family, remove and re-add, stale in-flight request, deletion, legacy row, and scoped share.
- Confirm raw source conversation visibility separately from shared family state.
- Confirm every durable or external effect has object, destination, scope, and receipt.

**Pass:** zero cross-adult sentinel reads and zero irreversible mistaken actions. Any privacy crossover is automatic no-ship.

### Loop 5: accessibility and reach

- VoiceOver order and announcements.
- Largest supported Dynamic Type without clipping or horizontal traps.
- Increased Contrast and Differentiate Without Color.
- Reduce Motion with equivalent Voice and progress state.
- 44-point targets and reachable primary actions.
- Keyboard, safe area, sheet, and system handoff behavior.

**Pass:** the same primary outcome completes with no material task or comprehension gap.

### Loop 6: craft and emotional tone

- Remove equal-weight cards, duplicate labels, and implementation vocabulary.
- Confirm each empty state demonstrates value.
- Character motion expresses system state, not decoration.
- Read copy aloud and eliminate rereads.
- Compare materials and transitions with the watercolor, rhythm-card, outdoor, and curriculum references.

**Pass:** the surface feels calm, tactile, and family-safe, with one memorable authored moment and no visual novelty that adds work.

### Loop 7: retention and invitation

- Is the next visit tied to a real result, not a streak or guilt prompt?
- Does a single-caregiver family receive the complete product?
- For an eligible parent-chosen task, would another adult improve the outcome?
- Is the least-access collaboration path selected: private, family-shared, scoped share, or public referral?

**Pass:** return and referral intent rise after verified outcomes while opt-outs, complaints, and privacy incidents stay below the predeclared guardrails.

### Loop 8: release and production proof

- Deterministic tests pass.
- Installed release build passes physical-device journey.
- Production alias or distributed build matches the tested commit.
- Typed analytics show the complete loop.
- Five-mom diagnostic protocol passes.
- Issue closes with final-path evidence, not repository presence or agent assertion.

## Metrics and kill rules

### North-star behavior

**Weekly families completing at least one Homa-assisted loop from capture to verified outcome.**

Verified outcomes include an approved or completed plan item, an approved material printed/shared/used, a confirmed observation or lesson record, a reviewed hours or state record, or a completed recurring task opened by the parent.

### Activation

- Install to authentication.
- Authentication to family-ready state.
- Family-ready to first relevant response.
- First response to first reviewed object.
- First reviewed object to first verified outcome.
- Time to first useful artifact, target under five minutes for the native onboarding slice.
- Permission acceptance only after a demonstrated need.

### Retention

- D1, D7, and D28 return by family stage.
- Closed loops per active family per week.
- Prepared-day and prepared-week starts.
- Binder reopen and material reuse.
- Proactive receipt open and completion.
- Returning sessions with the relevant active object or family state already available.

### Trust and fatigue guardrails

- Zero cross-adult sentinel reads.
- Silent-turn rate and stream-recovery success.
- Confirmed mistaken actions undone when supported.
- Accessibility task parity.
- AI claim corrections and source-open rate.
- Notification opt-out and complaint rate.
- Referral prompt dismissal and permanent opt-out.

**Kill rules:** stop a notification type if it produces fatigue or complaints above its predeclared limit; stop a referral prompt if it appears before a verified positive outcome; stop a feature if it increases false completion, privacy risk, or child-judgment language; stop a growth claim if the only evidence is an account invite rather than a completed family outcome.

## Sequencing

### P0, trust and proof

1. Resolve and ship [#606](https://github.com/sidneyswift/homa/issues/606), including the founder ruling on re-added adults.
2. Certify one physical-device Voice turn through interruption and recovery, [#620](https://github.com/sidneyswift/homa/issues/620).
3. Remove startup, consent, billing, and family-readiness indefinite waits.
4. Keep the Planner stale-safe release green in production and preserve the exact evidence receipt.

### P1, one complete reason to love Homa

1. Native first-family win, [#304](https://github.com/sidneyswift/homa/issues/304).
2. Today and one-thumb re-entry, [#303](https://github.com/sidneyswift/homa/issues/303).
3. Voice shell and active object, [#535](https://github.com/sidneyswift/homa/issues/535) and [#536](https://github.com/sidneyswift/homa/issues/536).
4. Evidence-first Progress, [#623](https://github.com/sidneyswift/homa/issues/623).
5. Print, share, calendar, recorder, and photo outcomes, [#538](https://github.com/sidneyswift/homa/issues/538), [#546](https://github.com/sidneyswift/homa/issues/546), [#545](https://github.com/sidneyswift/homa/issues/545), [#540](https://github.com/sidneyswift/homa/issues/540), and [#541](https://github.com/sidneyswift/homa/issues/541).
6. Closed-loop event contract and five-mom study, [#634](https://github.com/sidneyswift/homa/issues/634).

### P2, earned leverage

1. Push delivery receipts and warm-family brief, [#307](https://github.com/sidneyswift/homa/issues/307).
2. Camera capture of finished work after the upload trust gate.
3. Offline-readable state and safe draft recovery, [#621](https://github.com/sidneyswift/homa/issues/621).
4. Scoped caregiver collaboration and outcome-earned referral, [#629](https://github.com/sidneyswift/homa/issues/629) and [#628](https://github.com/sidneyswift/homa/issues/628).
5. iPad, orientation, appearance, localization, and richer motion after the equivalent accessibility paths pass.
6. App Store story and review package, [#308](https://github.com/sidneyswift/homa/issues/308).

## Founder decisions that block honest completion

- If an adult is removed and later added back, do old private chats, calls, attachments, and raw evidence remain hidden unless a separate restore flow is used? This blocks #606, #607, and #618.
- What cadence and delivery channels are approved for the weekly progress check-in, #401?
- What family records remain readable after cancellation?
- Is dark appearance a launch requirement or an explicit later target?
- When does iPad become a supported native target?
- Is optional caregiver collaboration allowed to use a shared rhythm, and if so, what is the no-guilt boundary?

## Award exit criteria

Homa can call the native app award-caliber only when:

- Production privacy P0 is fixed, deployed, migration-verified, and adversarially probed.
- A fresh parent can install, become family-ready, and complete a useful outcome in under five minutes without leaving native.
- Voice, text, and visible object context continue as one conversation, with listening state legible through every handoff.
- Today answers what matters now in one glance and the week view answers the complete requested range.
- Progress starts with evidence, confidence, and a next move, never an age-gap verdict.
- Every durable or external effect has preview, truthful completion, and appropriate undo.
- Five participants complete the five priority journeys without a command cheat sheet; any privacy or false-completion failure is no-ship.
- Every priority journey passes the accessibility matrix and physical-device release proof.
- Closed-loop analytics show activation, repeat value, and trust failures without counting access grants as homeschool outcomes.
- The single-caregiver journey is complete. Optional collaboration adds task value without exposing private raw conversation.
- App Store materials communicate the capture-to-outcome loop in one sentence and show the actual native app.
- No issue closes on screenshots, repository presence, or an agent claim alone.

The product thesis remains:

> Homa wins when a parent can say one ordinary sentence and end with the right next step, the right artifact, and the right family record, while staying fully in control.
