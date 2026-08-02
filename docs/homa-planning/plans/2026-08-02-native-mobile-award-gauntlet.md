# Homa native mobile award gauntlet

**Date:** 2026-08-02  
**Status:** Evidence-backed product and UX audit, issue architecture, and ship gates  
**Primary lens:** A homeschooling mom using one hand, often while teaching, running the day, carrying a child, or solving an interruption  
**Product boundary:** Homa is the parent's command center. The best result usually leaves the screen and becomes a conversation, lesson, printable, outing, observation, or calmer plan.

## 1. Executive verdict

Homa already has more native capability than its launch epic and mobile README describe. Voice is the default route. Code exists to preserve one Voice session across navigation. Planner, Progress, Hours, Binder, Tasks, Settings, native print, native share, selected calendar export, lesson recording, rich chat cards, material review, state records, and StoreKit are present in code. Several surfaces were observed in the simulator. That is not yet physical-device or release proof.

That is the good news. The harder truth is that the experience still reads as a set of capable destinations, not one unmistakable promise:

> Tell Homa what is happening. She helps you decide the next useful thing, does the approved work, and keeps the right family record without making you manage an app.

The award opportunity is not another feature pile. It is one closed loop that every surface reinforces:

1. Notice a need.
2. Capture it by voice, camera, file, or tap.
3. Let Homa propose the smallest useful next move.
4. Review the exact effect.
5. Complete it in the room, on paper, or through an explicit device handoff.
6. Save only the evidence or family state that belongs.
7. Return with the next move already prepared.
8. When the parent chooses and the task is eligible, offer the least access needed to involve another trusted person.

The present app breaks that loop in several material places:

- A new family still leaves native for onboarding and can fall into a half-created account state.
- There is no single Today surface that answers, “What matters now?”
- Progress leads with age-gap labels such as “Ahead · +11 mo” instead of evidence, confidence, and a useful next move.
- Binder and Planner can become dense walls of equally weighted content.
- Settings asks for data in forms that feel like a database editor.
- Native analytics record a few feature completions but not the family loop.
- Push, widgets, offline continuity, iPad, broad Dynamic Type verification, localization, and a complete accessibility gauntlet are absent.
- A confirmed production privacy flaw can expose one adult's raw chat or voice text to another adult in the same family. No delight or growth work can compensate for that trust failure.

The product should not claim award readiness until the trust gate, physical-device spoken-turn proof, fresh-family activation, accessibility gauntlet, and five-mom task test all pass.

## 2. What “App of the Year” means for Homa

Apple currently recognizes technical ingenuity, innovation, user experience, design, and cultural impact in its App Store awards. The 2026 Apple Design Awards name six award categories: Delight and Fun, Inclusivity, Innovation, Interaction, Social Impact, and Visuals and Graphics. Apple does not publish the seven-part scorecard below. It is Homa's internal translation of those categories and the App Store award criteria.

For Homa, those become seven concrete bars:

| Bar | Homa interpretation | Proof required |
|---|---|---|
| Meaningful delight | Homa makes a chaotic homeschool moment feel lighter without becoming cute decoration | In a five-participant usability pass, at least four participants complete one priority journey without moderator rescue and rate it easier than their existing method for the same job |
| Inclusive by default | Voice, text, large text, screen reader, contrast, reduced motion, motor reach, and plain language all reach the same outcome | Accessibility matrix passes on supported iPhone sizes, VoiceOver, large Dynamic Type, Increased Contrast, Differentiate Without Color, and Reduce Motion |
| Native interaction | Voice persists, active objects make “this” work, system print/share/calendar sheets are truthful, and every control respects iOS conventions | Physical-device journey proof, not simulator screenshots alone |
| Product innovation | Homa turns a live family moment into a grounded, approved, useful homeschool outcome | Capture-to-outcome journey succeeds without a command cheat sheet |
| Social impact | The app returns time, confidence, and attention to families while protecting children and adult privacy | Parent-reported time saved, zero cross-adult sentinel reads in the full adversarial fixture, and transparent evidence handling |
| Visual coherence | The clay Homa character, materials, planner, and system surfaces feel like one product with calm hierarchy | Design review finds no orphaned visual language or equal-weight information walls |
| Cultural impact | Parents naturally describe Homa as how their family keeps school moving | Unaided product description and voluntary recommendation intent are collected separately from optional caregiver access and artifact sharing |

An award is an external judgment, so it cannot be guaranteed by a backlog. This plan defines the product standard and evidence that make Homa a credible contender.

## 3. Evidence base and confidence

### Current product evidence

- Native routes and components under apps/mobile/src.
- Expo configuration in apps/mobile/app.json.
- Native package and capability inventory in apps/mobile/package.json.
- Current simulator walkthroughs of Voice, Planner, Progress, Binder, and Settings.
- Existing launch and Voice workbench issues, especially gh#299 and gh#534.
- Existing product contract and founder rulings.

### Family reference evidence

- Watercolor space reference cards, 2026-08-01.
- Daily rhythm cards, 2026-07-18.
- Morning menu starter, 2026-07-18.
- Beast Academy printables, 2026-07-13.
- Outdoor toddler activity book, 2026-07-20.
- The Peaceful Preschool curriculum, 2026-08-01.
- Blossom and Root Early Years curriculum, 2026-07-20.

### Category evidence

The benchmark uses official product and platform sources wherever possible:

- [Apple 2026 Design Award winners](https://www.apple.com/in/newsroom/2026/06/apple-reveals-winners-of-the-2026-apple-design-awards/)
- [Apple 2025 App Store Award winners](https://www.apple.com/ph/newsroom/2025/12/apple-unveils-the-winners-of-the-2025-app-store-awards/)
- [Apple onboarding guidance](https://developer.apple.com/design/human-interface-guidelines/onboarding)
- [Duolingo Friend Streak](https://blog.duolingo.com/friend-streak/)
- [Duolingo streak improvements](https://blog.duolingo.com/improving-the-streak/)
- [Duolingo learning path](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)
- [Photomath](https://photomath.com/)
- [Brilliant FAQ](https://brilliant.org/faq/)
- [Brilliant streak behavior](https://brilliant.org/help/features/what-is-a-streak/)
- [Quizlet AI study tools](https://quizlet.com/features/ai-study-tools)
- [Quizlet AI flashcard generator](https://quizlet.com/features/ai-flashcard-generator/)
- [Prodigy parent experience](https://www.prodigygame.com/main-en/parents)
- [Lingokids Parents Area](https://help.lingokids.com/hc/en-us/articles/115005129325-What-is-the-Parents-Area)
- [Lingokids Plus](https://help.lingokids.com/hc/en-us/articles/115005650309-Lingokids-Plus)
- [Khan Academy parent dashboard](https://support.khanacademy.org/hc/en-us/articles/360039664491-What-can-I-do-from-the-Khan-Academy-Parent-Dashboard)
- [ClassDojo overview](https://static.classdojo.com/img/2025/08/classdojo-1pager-v3.pdf)
- [ChatGPT tasks](https://help.openai.com/en/articles/10291617-tasks-inchatgpt)
- [ChatGPT projects](https://help.openai.com/en/articles/10169521-projects-in-chatgpt)
- [ChatGPT study mode](https://help.openai.com/en/articles/11780217-chatgpt-study-mode-faq)
- [Claude voice mode](https://support.anthropic.com/en/articles/11101966-using-voice-mode-on-claude-mobile-apps)
- [Claude artifacts](https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them)
- [Claude projects](https://support.anthropic.com/en/articles/9517075-what-are-projects)
- [Perplexity projects](https://www.perplexity.ai/help-center/en/articles/10352961-what-are-spaces)
- [Perplexity answer and source model](https://www.perplexity.ai/help-center/en/articles/10352895-how-does-perplexity-work)

Claims about the current Homa app are code or walkthrough observations. Claims about what moms want are product hypotheses grounded in the references and prior field studies until tested with real families. The gauntlet keeps those two evidence classes separate.

## 4. The parent job map

The primary persona is a homeschooling mom, but every job below should work for any authorized caregiver. “Mom” is used here to preserve the requested product lens, not to narrow who can use Homa.

Legend:

- **Strong:** useful native journey exists.
- **Partial:** meaningful capability exists, but the loop or state contract is incomplete.
- **Missing:** no complete native journey.
- **Blocked:** a founder ruling, access grant, or external dependency is required.

Only these four values appear in the tables. “Strong” still requires final-path verification before an issue can close.

### A. Run today without becoming the project manager

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Know what matters now | On open, show at most three proposed priorities, why each appeared, and one obvious next action; the parent can change them and Homa never silently ranks children | Missing | Build Today around current family state and parent authority, not a generic dashboard |
| Start the school day | One tap or one sentence starts the prepared rhythm, with supplies and first activity ready | Missing | Add “Start our day” action with a light daily brief |
| Salvage the next ten minutes | When a lesson stalls or a child needs a reset, offer one low-prep option without opening a planning workflow | Missing | Add an in-the-moment reset outcome to Voice and Today |
| End the day without debt | Let the parent mark work done, defer it, replace it, or drop it, with no implied obligation to recover everything | Missing | Add “We are done for today” and explicit disposition choices |
| Recover when the day changes | “We are skipping math” updates only the affected plan and shows the new shape | Partial | Make plan changes previewable, reversible, and conversational |
| See each child's day | Fast child switch without duplicating family-wide events or comparing siblings | Partial | Preserve child color and identity, remove equal-weight clutter |
| Coordinate two children at once | Show simultaneous needs without ranking children, then help the parent choose or stage the next actions | Missing | Add multi-child load and handoff states |
| Check off real work | Large, reachable controls, immediate state, undo, and no accidental double write | Strong | Keep atomic per-toggle write and add completion telemetry |
| Move unfinished work | Drag, tap, or voice reschedules with a visible destination and undo | Partial | Unify unscheduled tray and day move into one interaction |
| Add an appointment or co-op | Natural language or a short native sheet, with recurrence shown plainly | Strong | Polish validation, conflict display, and accessibility labels |
| Look a week or month ahead | Show weekly load, conflicts, and open decisions before the activity detail | Partial | Reduce text density and reveal detail on demand |
| Put selected items on the phone calendar | Preview exact events, request write-only access at use, then report each result | Strong | Retain current selected-export trust contract |
| Keep a recurring family rhythm | Reuse known routines without rebuilding every week | Partial | Surface reusable routines and exceptions in Today and Planner |

### B. Ask for help in the middle of real life

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Talk while hands are busy | Voice is the first-class entry, starts predictably, and makes listening state unmistakable | Partial | Prove a real spoken exchange on a physical device |
| Switch between speaking and typing | Same conversation, context, and active object survive the mode switch | Partial | Unify server history and show the shared thread |
| Ask “what about this?” | Homa receives an authenticated reference to the visible object and never guesses | Partial | Complete gh#536 across every visible surface |
| Navigate while talking | Voice continues through Planner, Binder, Progress, Hours, and Tasks | Partial | Complete physical-device interruption and audio-route tests |
| Interrupt or stop Homa | One reachable stop action works immediately and preserves the parent's words | Partial | Apply one interruption contract to both modes |
| Know what Homa heard | Short transcript ribbon, easy correction, no wall of raw transcript | Partial | Add correction and privacy controls |
| Capture now, organize later | One sentence saves a clearly labeled inbox item without forcing the parent to choose a plan destination in the moment | Missing | Add a bounded family inbox with later triage |
| Understand what Homa is doing | Show a plain progress state for long work, with safe cancel or resume | Partial | Finish resumable job and active-work cards |
| Recover after signal loss | Preserve draft, explain what is safe, and offer one retry path | Partial | Add offline and reconnect journey tests |
| Undo an accidental action | Resolve the latest reversible receipt, show exact effect, ask only if ambiguous | Strong | Preserve the shipped gh#544 receipt and compensator contract |
| Never fake activity | The app never looks active when the model, stream, or permission has failed | Partial | Add startup, consent, stream, and receipt watchdogs |

### C. Make learning work that leaves the screen

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Make a lesson or worksheet | One sentence creates a useful first draft grounded in child and goal | Partial | Measure time to useful preview and parent acceptance |
| Make it fit this child | Show what changed, why, and the evidence used, without a verdict on the child | Partial | Add child-fit explanation and confidence |
| Make a sibling version | Reuse the activity while adapting load, never comparing siblings | Partial | Complete version lineage and child-safe copy |
| Revise naturally | “I like it, but shorten this” revises without finalizing the old version | Strong | Preserve the shipped gh#537 mixed-intent eval and family-scoped version contract |
| Approve without product vocabulary | Keep, Change, Print, and Share match normal parent language | Partial | Standardize completion controls across Voice, Chat, and Binder |
| Print the right version | Exact preview, pages, copies, system printer sheet, truthful completion | Partial | Complete the still-open physical printer proof in gh#538 |
| Share from the parent's own app | Native share sheet, editable note, explicit sender identity | Partial | Complete physical-device test for gh#546 |
| Find it later | Search by child, subject, kind, date, and source with useful recent defaults | Partial | Reduce Binder state-record dominance and improve search hierarchy |
| Reopen an unfinished idea | Draft and active work survive the session with a clear next step | Partial | Finish gh#175 and native active-work cards |
| Use an existing workbook or PDF | Preserve source pages, cite them, preview adaptations, ask before scheduling | Partial | Complete gh#542 and Family Library linkage |
| Upload the family's own resources | Honest progress, failure recovery, private storage, original download | Partial | Finish gh#352 and gh#369 |
| Prepare supplies | Turn an approved plan into a grouped, editable list | Missing | Add a reusable supply-list outcome after demand proof |
| Make learning playful | Offer puzzle, story, hunt, comparison, or hands-on modes when they fit | Partial | Encode reference-led craft in materials skill and evals |
| Keep screens from becoming school | Default to print, movement, conversation, observation, and outdoor work | Partial | Add “off-screen outcome” as a material quality and product metric |

### D. Notice learning without judging the child

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Capture what happened | Voice, text, photo, or recording proposes a short observation for confirmation | Partial | Finish photo and lesson-review journeys |
| See recent evidence | Lead with a concrete quote, work sample, or observed behavior and its date | Partial | Reorder Progress around evidence, not level labels |
| Know what to try next | Every insight ends with one small, relevant next move | Missing | Build “Try next” cards from validated progress state |
| Understand confidence | Distinguish observed, inferred, and not yet known in plain language | Missing | Add confidence and source disclosure |
| See change over time | A calm story of dated observations, changing support needs, and the parent's chosen next moves | Partial | Add trajectory with sparse, readable milestones |
| Resolve conflicting evidence | Show both pieces and ask the parent, never silently average them | Missing | Port the exact conflict-resolution flow |
| Celebrate a real first | Save meaningful firsts or breakthroughs without gamifying the child | Missing | Add parent-controlled keepsakes |
| Prepare for a conversation | Summarize evidence and questions for a co-op teacher, evaluator, or partner | Missing | Add shareable evidence brief with privacy preview |
| Avoid comparison | No sibling rank, red “behind,” age-gap verdict, or shame loop | Partial | Replace “Ahead · +N mo” presentation |
| Control what is remembered | Show what Homa saved, why, who can see it, and how to undo it | Partial | Add visible memory and progress receipts |

### E. Keep records without becoming a clerk

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Log hours quickly | Voice or one-tap reuse, with exact child, subject, date, and duration visible | Partial | Add a native quick-log entry and recent reuse |
| Correct an entry | Edit or delete with clear before and after state and undo where safe | Strong | Add result telemetry and cross-surface proof |
| See progress toward a requirement | State target, completed amount, remaining amount, and source date | Missing | Add state-aware target context without legal overclaim |
| Explain an unusual day | Optional note or evidence, not a required form | Partial | Make exception capture lightweight |
| Produce an attendance or state packet | Show included records, missing facts, sources, and last verification | Partial | Preserve shipped gh#543 and cover its residual physical-device Print and Share proof through the open destination tickets |
| Know who files it | Homa prepares; the parent reviews, signs, and files | Strong | Keep this wording at every handoff |
| Export family records | Clear scope, format, progress, and completion receipt | Missing | Add export from deliberate Settings flow |
| Keep records after cancellation | Readable and exportable history follows approved entitlement policy | Blocked | Resolve gh#294 and implement the ruling |

### F. Let Homa help before being asked

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Receive a useful morning brief | Only after warm use, with today, supplies, and one watch item | Partial | Complete ruled task and notification channel |
| Know when a long job finishes | Delivery receipt links directly to the result | Missing | Build push as a channel with deep links |
| Get a gentle weekly reflection | Five minutes, one child, no repeated question, one-tap off | Blocked | Founder ruling on cadence and outbound policy in gh#401 |
| Let Homa run a recurring task | Plain schedule, next run, pause, run now, and history | Strong | Improve task naming and empty-state education |
| Understand a proactive suggestion | Explain why now, what Homa used, and dismiss or tune it | Missing | Add suggestion provenance and preference controls |
| Control quiet hours and channels | One place for push, email, SMS, and task delivery settings | Missing | Build channel preferences before broad notifications |
| Recover a missed rhythm | Resume with the smallest useful action, never guilt or punitive streak copy | Missing | Use protected rhythm, not streak loss |

### G. Coordinate the family and trusted helpers

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Invite another caregiver | Explain shared versus private data before sending, show pending and accepted states | Missing | Build adult invitation and access center |
| Know who can see what | A plain privacy ledger per adult and data class | Missing | Make the founder privacy contract visible |
| Keep raw conversations private | Each adult sees only their own chats, calls, attachments, and raw evidence | Blocked | Fix gh#606 before growth work |
| Share approved family state | Planner, final materials, progress state, and tasks remain family resources | Partial | Distinguish shared state from private source conversations |
| Revoke access safely | Show future access effect and separately explain retained private history | Blocked | Founder ruling on re-add visibility and deletion behavior |
| Bring a partner into a real task | Invite from a plan, artifact, or weekly review, not a generic referral prompt | Missing | Build contextual collaboration invitations |
| Share with a co-op or evaluator | Preview exact document and channel; use the parent's sender identity | Partial | Expand native share outcomes with privacy preview |
| Give a helper one narrow thing | Let a tutor, evaluator, co-op teacher, or grandparent receive one approved artifact or request without joining the family account | Missing | Define a scoped share or comment contract distinct from caregiver membership |
| Hand off the day | “Here is what is done, what changed, and what needs you” in under a minute | Missing | Add caregiver handoff summary |
| Avoid duplicate work | Show recent family actions and current owner without exposing private transcript | Missing | Add shared action receipts, not shared raw chat |

### H. Manage trust, access, and the product itself

| Mom job | Award-level UX expectation | Current state | Required move |
|---|---|---|---|
| Sign in the expected way | Apple, Google, and email paths explain what happens next | Partial | Complete fresh-install and provider tests |
| Recover a password | Native entry, working email link, safe landing, return to app | Missing | Complete gh#327 |
| Finish setup natively | Account, family, child, first request, first useful result, and plan choice stay coherent | Missing | Complete gh#304 |
| Understand the plan and price | One Monthly or Annual toggle, tier differences at the relevant action, restore always visible | Partial | Align native paywall with approved pricing behavior |
| Restore a purchase | Clear progress, result, and next action if no purchase is found | Partial | Complete sandbox and real-account proof |
| Get help | Visible private report path with honest response expectation | Partial | Complete gh#528 |
| See and change AI consent | Current choice, consequences, retry on failure, and reversible settings | Partial | Fix consent bootstrap hang and add Settings control |
| Export or delete data | Inventory exact scope, strong confirmation, progress, and receipt | Partial | Finish safe family export and deletion contracts |
| Use the app with accessibility needs | Same outcomes with VoiceOver, large text, contrast, reduced motion, and reachable controls | Partial | Run a complete route-by-route accessibility gauntlet |
| Use it in weak connectivity | Read recent safe state, queue local intent where safe, and explain what cannot happen | Missing | Define offline contract by data class |
| Correct Homa's family assumption | Show the remembered assumption, let the parent correct it, and preview which plans or suggestions may change | Missing | Add inspectable family-preference and memory controls |
| Set family boundaries once | Capture goals, methods, available energy, budget, screen limits, and firm boundaries without forcing a long setup form | Partial | Use conversational setup with an editable summary |
| Use it on the family's devices | iPhone first, then iPad and orientation only when layouts genuinely adapt | Partial | Build responsive information hierarchy before enabling iPad |
| Understand every failure | Plain cause category, what is safe, one next action, never raw provider text | Partial | Standardize error taxonomy and receipts |

### Guarded frontier

Some desired outcomes need a deliberate boundary before they become product promises:

| Outcome | Current posture |
|---|---|
| Discover or compare curriculum | Useful future job; recommendations must cite fit evidence, budget, method, and family constraints |
| Purchase physical supplies | Preview an editable list and hand off to a merchant before considering any payment authority |
| Purchase digital curriculum | Requires content-entitlement, App Store, refund, and provenance rulings |
| Connect another homeschool app | Requires per-connector permissions, revocation, source freshness, and failure states |
| Send an email or make a phone call from Homa | Requires explicit recipient, payload or script, sender identity, consent, and completion receipt |
| Submit a legal filing | Unsupported under the current ruling; Homa prepares and the parent files |
| Listen continuously in the background | Blocked pending privacy, battery, accidental-capture, and platform rulings |
| Recognize a child by face | Never build |

## 5. Universal UX state contract

Every product feature must define these states before it can be called complete:

| State | Required behavior |
|---|---|
| Entry | The parent can predict what will happen before acting |
| Permission prime | Explain the immediate benefit before the system prompt, request the narrowest access |
| Loading | Name what is loading; preserve useful prior state; never replace the whole screen with uncertainty |
| Streaming or working | Show current phase, elapsed expectation where honest, and Stop or Leave safely |
| Review | Show the exact child, object, date, destination, and proposed effect |
| Commitment | Confirm once at the last responsible moment for durable, external, financial, access, or destructive effects |
| Success | State what happened, where it lives, and the one likely next action |
| Undo | Offer immediate reversal for reversible family-state changes |
| Empty | Explain the value, show a believable example, and offer one action that creates the first useful item |
| No results | Preserve the search or filter and explain how to broaden it |
| Error | Say what did not happen, what remains safe, and one recovery action |
| Offline | Separate readable cached state, queued safe intent, and actions that need connection |
| Interrupted | Preserve draft and object identity across app backgrounding, calls, audio route changes, or session loss |
| Entitlement | Explain why the boundary appears at this useful action, preserve the work, and make restore visible |
| Accessibility | Announce state changes, preserve semantic order, support large text, and never encode meaning by color alone |
| Privacy | Name whether the input and output are private to this adult, shared with the family, or leaving Homa |

This contract is more important than screen parity. A screen that exists only in its happy state is not a finished mobile feature.

## 6. What the category leaders teach

The second column is limited to behavior described by the linked first-party sources in section 3. The third column is a Homa product inference that still needs validation.

| Product | Official-source product fact | Homa inference to test | What Homa should reject |
|---|---|---|---|
| Duolingo | Its path selects the next lesson; streak experiments lowered the daily threshold; Friend Streak lets two users maintain a shared streak | One obvious next homeschool action and a low-energy “keep the rhythm” option may reduce re-entry effort. An optional shared rhythm must be tested separately | Punishment, shame, child comparison, or a streak that turns family life into debt |
| Photomath | Camera capture recognizes a problem, shows steps, offers multiple methods, and lets the user edit a scan | Camera or Voice capture should produce an editable interpretation with visible evidence | Treating AI extraction as fact or hiding a bad capture |
| Brilliant | Courses use interactive problem solving, immediate feedback, personalized paths, and short lessons | Compact guided parent actions may work better than a long explanation | Turning the parent command center into a child lesson game |
| Quizlet | Notes, slides, PDFs, and handwriting can become editable flashcards, guides, and tests | Family resources should become grounded plans, worksheets, or reviews without losing source links | Opaque generation that loses the original source |
| Prodigy | Its parent portal shows progress, reports, goals, encouragement, rewards, and practice sheets | Parent-facing evidence may be more useful when it ends with one relevant action | Extrinsic reward loops that compete with the family's learning values |
| Lingokids | Its Parents Area supports child profiles, progress, per-child screen time, offline downloads, and printables | Per-child controls and offline-ready outputs fit Homa's low-screen posture | Treating content volume as personalization |
| Khan Academy | Its parent dashboard organizes children, assignments, activity, progress, mastery, time, badges, and streaks | Skill state should be attached to dated evidence and a parent decision | Dense dashboards without a useful next action |
| ClassDojo | Its product combines two-way translated messages, calendars, events, portfolios, and adult oversight | A parent-chosen caregiver handoff may create household value when raw adult conversations remain private | Default sharing of private source conversations |
| Tiimo | Apple describes its visual planner and thoughtful AI as turning aspirations into actionable next steps | Today may work best as a calm visual plan with one parent-controlled next action | A generic AI chat sitting beside the planner |
| ChatGPT | Voice, files, projects, study mode, and scheduled tasks span devices and sessions | Shared family state, each adult's private conversation, proactive tasks, and files should continue across devices without being blended together | A blank general-purpose composer as the primary information architecture |
| Claude | Voice keeps key points visible; Artifacts are persistent and editable; Projects carry scoped files and instructions | Active-object conversation and versioned family artifacts should reduce transcript hunting | Long transcripts as the main product surface |
| Perplexity | Answers expose sources; Projects scope files and context; memory can be viewed, edited, or deleted | Source citations and inspectable memory may increase trust in plans and progress explanations | Confident answer styling without evidence or scope disclosure |
| 2026 Apple Design Award examples | Apple highlights simple meaningful moments, effortless gestures, understandable data, coherent animation, and built-in accessibility | Fewer controls, stronger hierarchy, accessible character motion, and one distinctive interaction may improve comprehension and recall | Visual novelty that adds steps or hides system state |

### Homa hypotheses synthesized from the benchmark

The following are hypotheses to test, not universal facts about every benchmarked product:

1. Shortening intent-to-value should improve activation.
2. One obvious next action should reduce cognitive load.
3. Persistent, editable outputs should increase reuse.
4. A return reason tied to real family value should retain better than an abstract streak.
5. Optional collaboration or cross-device continuity should add value only when the parent chooses it.

Homa can test all five without copying a feed, punitive streak, or generic chatbot.

## 7. What the family references teach

| Reference pattern | Product meaning | Native implication |
|---|---|---|
| Daily rhythm cards and morning menu | Predictable rituals reduce executive load and create child ownership | Today should make the family rhythm visible and reusable, with child-readable cards available for print |
| Watercolor space cards | Air, restraint, tactile beauty, and observation beat cartoon clutter | Materials and previews need hierarchy, generous whitespace, and specimen-like care |
| Beast Academy puzzles | Challenge can feel like play when the form itself is interesting | Homa should choose puzzles, hunts, comparisons, and visual reasoning when they fit |
| Outdoor toddler activities | The learning result is movement, mess, nature, and supervised discovery | Material quality should score whether the activity leaves the screen and uses ordinary supplies |
| Peaceful Preschool | One book and one letter can anchor a connected week with low parent prep | Planner should show the week's anchor, book list, supplies, and optional extensions before daily detail |
| Blossom and Root | Short activities, free play, household materials, and permission not to finish everything | Homa should plan with slack, label optional work honestly, and never create completion guilt |

The references are not merely an illustration style. Together they define Homa's product posture:

> Digital preparation should create tactile, predictable, low-prep family life.

## 8. Current native experience evidence gates

Evidence states:

- **Code present:** implementation exists, but the journey was not observed.
- **Simulator observed:** the surface or interaction was observed in a simulator.
- **Device proof missing:** a journey depends on real audio, system destinations, hardware, or interruption behavior that has not passed on a physical device.
- **Production blocked:** a confirmed production failure prevents a safe release claim.
- **Journey incomplete:** one or more required steps or states do not exist.
- **Harmful framing present:** the surface works mechanically but violates a binding child, trust, or copy rule.
- **Partial code evidence:** relevant implementation exists, but route-wide coverage has not been audited.
- **Plan present:** scoped tracker work exists, but final product or release evidence does not.

A cell may combine states when they describe different facts, such as a simulator-observed surface whose physical-device proof is still missing.

| Dimension | Evidence state | Evidence |
|---|---|---|
| Voice identity and differentiation | Simulator observed, device proof missing | Voice-first route, Homa character, transcript ribbon, active overlays, and persistent workbench provider exist; a real spoken exchange remains unproven |
| Core capability breadth | Code present | Planner, Binder, Progress, Hours, Tasks, records, billing, print, share, calendar, and recorder exist |
| Daily information architecture | Journey incomplete | No Today; six destinations live in a drawer; Voice empty state carries too much responsibility |
| Fresh-family activation | Journey incomplete | Native sign-in exists, but signup and onboarding leave the app and can create a family-less auth user |
| Planning usability | Simulator observed | Real writable day, week, and month planner; the unscheduled backlog overwhelms the visible week |
| Progress usefulness | Simulator observed, harmful framing present | A rich projection exists, but age-gap verdicts lead and a useful next action is absent |
| Materials and off-screen outcomes | Simulator observed, device proof missing | Creation, Binder, native print, native share, and references exist; physical destinations and lifecycle remain incomplete |
| Proactive help and retention | Journey incomplete | Tasks are useful, but there is no push channel, Today ritual, widget, or complete weekly review |
| Optional family collaboration | Journey incomplete | Shared family state exists, but native invitations, handoff, role clarity, scoped-helper sharing, and a privacy ledger do not |
| Trust and privacy | Production blocked | gh#606 confirms cross-adult raw transcript exposure |
| Reliability and recovery | Journey incomplete | Chat has thoughtful retry work; startup, consent, offline, and end-to-end Voice proof remain incomplete |
| Accessibility and adaptation | Partial code evidence | Many semantic labels and Reduce Motion exist; the app is light-only, portrait-only, iPhone-only, with no complete large-text or VoiceOver audit |
| Instrumentation | Journey incomplete | Completion events exist for chat, print, share, and calendar; activation and closed-loop events do not |
| App Store presentation | Plan present | The launch package is planned, but old issue and README descriptions are stale and the final product story is unresolved |

### Screen-by-screen visual gauntlet

| Surface | What already works | What the current visual hierarchy says | Award-level correction |
|---|---|---|---|
| Voice | Distinctive Homa character, calm palette, obvious talk action | A very large idle character and two talk prompts compete with a truncated recommendation that has no clear action | Make system state and the single next action dominant; tie any suggestion to a tappable outcome or remove it |
| Planner | Day, week, and month modes; real writes; calendar export | “Not yet on a day” fills the first screen with long equal-weight items, while the actual week is pushed away | Show this week's commitments and load first; collapse unscheduled work into a count, a reason, and the next two decisions |
| Progress | Child-specific dated data and expandable subjects | Repeated “Ahead · +N mo” pills become the visual thesis; evidence and next action are secondary or absent | Lead with one dated observation, confidence, and one parent-chosen next move |
| Binder | Strong legal record detail and material lifecycle | A full state-record packet dominates the Binder before the parent's recent materials appear | Give records their own compact entry and let recent, in-progress, and reusable learning work lead |
| Settings | Real plan state, child data, support, sign out, and deletion | Large empty cards and a database-like add-child form make setup feel clerical; “comma-separated” is implementation language | Use a date picker, interest chips or conversational intake, collapsible add-child flow, and concise account rows |
| Sign in | Apple, Google, and email options are present and ordered correctly | “Open onboarding” tells a new family that native is not the real product; no password recovery exists | Keep account creation, family readiness, reset, and return in one coherent native flow |
| Paywall | StoreKit, entitlement reconciliation, provider-aware management, and restore exist | The wall can appear before the parent has experienced Homa's differentiated outcome | Preserve the first approved demand-test boundary and show the wall at the relevant value moment |
| Hours | Exact records and correction paths exist | Logging new time is not a first-class native action, so the screen is mainly a ledger | Put recent reuse, quick log, state context, and correction in one reachable flow |
| Tasks | Schedule, pause, run now, history, and feedback are substantial | “Homa's tasks” explains the model but not which result matters to the parent now | Lead with the next useful delivery and its destination, then expose schedule mechanics |

## 9. The product loop and metrics

### North-star behavior

**Weekly families completing at least one Homa-assisted homeschool loop from capture to verified outcome.**

A verified outcome is not a model response. It is one of:

- A plan item approved, scheduled, moved, or completed.
- A material approved and printed, shared, or used.
- A lesson or observation captured and confirmed.
- An hours or compliance record reviewed and saved.
- A recurring task completed and opened.

### Activation

- Install to successful authentication.
- Authentication to family-ready state.
- Time to first relevant Homa response.
- Time to first reviewed object.
- Time to first completed outcome.
- Percentage reaching a printed, scheduled, saved, or shared result in the first session.
- Permission acceptance only after a demonstrated need.

### Retention

- D1, D7, D28 return by acquisition and family stage.
- Weekly closed loops per active family.
- Families beginning a prepared day or week.
- Parent-chosen disposition after a disrupted day: completed, deferred, replaced, or dropped. No option is scored as morally better.
- Binder reopen and reuse rate.
- Proactive task open and completion rate.
- Percentage of returning sessions where Homa already knows the relevant active object or family state.

### Optional caregiver collaboration

- Eligible families offered collaboration only from a parent-chosen task.
- Adult invitations sent, accepted, declined, expired, or revoked.
- Time from acceptance to the first shared family outcome, reported only for families that voluntarily add a caregiver.
- Single-caregiver task completion and retention remain first-class and are never treated as a lower-conversion cohort.

### One-off artifact sharing

- Share-sheet opens after a parent explicitly selects a printable, plan, or evidence brief.
- Homa records only that the system share sheet opened and whether the app regained control. It does not infer delivery, recipient identity, or recipient behavior from a system handoff.
- Scoped helper access, if built, has its own approved object, recipient, expiry, and revocation contract.

### External word of mouth

- Voluntary recommendation intent collected after a completed outcome, not after access grants, failures, or support events.
- Parent-reported “I told another family” signal, collected without a nagging prompt.
- Public referral measurement must be designed separately from family membership and family artifact sharing.

### Trust and guardrails

- Zero cross-adult sentinel reads across every raw data path.
- Crash-free and hang-free sessions.
- Silent-turn rate.
- Stream recovery success.
- Confirmed mistaken actions successfully undone divided by confirmed mistaken actions where undo is supported.
- Notification opt-out and complaint rate.
- Consent load failure rate.
- Accessibility task completion parity.
- Support reports per 1,000 closed loops.
- AI claim corrections, source-open rate, and memory undo rate.

## 10. GitHub epic architecture

The tracker already contains valuable work. The award program should reorganize it without duplicating it.

### Program parent: refresh gh#299

gh#299 should remain the iOS program parent, but receive a dated comment that supersedes its stale “three-screen skeleton” snapshot. Its body remains historical evidence.

### Existing canonical owners

- gh#299 remains the native program and release parent. Per-adult privacy gh#606 stays a direct release gate.
- gh#302 owns chat stall watchdogs, lost-turn recovery, render-by-kind, and generic receipts. gh#376 is its implementation child; gh#211 is absorbed.
- gh#534 owns persistent Voice, active objects, natural approval, print, month planning, recorder, photo, PDF-to-plan, state packet, undo, calendar, share, and physical-device Voice proof.
- gh#304 owns native family-ready onboarding, first useful artifact, deferred permission primes, and time-to-first-win.
- gh#303 owns Today, Planner, and deep links. gh#263 is already absorbed. Today may render a caregiver handoff summary, but the teamwork epic owns its meaning and data.
- gh#352 owns family-uploaded resources and grounded reuse. gh#369 remains its storage-trust dependency.
- gh#307 owns push delivery and other native retention leverage.
- gh#308 owns App Store presentation and submission proof. The engineering-quality and study children below belong to gh#299; gh#308 consumes their evidence.

### New epic A: Progress that tells mom what to do next

Purpose: replace judgmental level reporting with evidence, confidence, a useful next move, and parent control.

Relationships:

- Direct dependency: gh#606 must ship before raw progress evidence can be trusted across adults.
- Shared input: gh#401 may provide a weekly check-in if the founder approves it.
- Shared input: gh#541 may provide a confirmed photo observation while remaining owned by gh#534.
- Neighboring owner: gh#181 owns portfolio accretion and keepsakes.
- Separate compliance work: gh#317 remains a state-evidence report under its existing owner, not a Progress child.

Genuinely new children:

- Remove age-gap verdict presentation from Progress.
- Evidence-first native Progress with confidence, conflicts, receipts, and one next move.
- Shareable evaluator or co-op evidence brief.

gh#393 remains part of the gh#403 feedback system. Progress may consume that signal but does not own it.

### New epic B: Family teamwork and earned word of mouth

Purpose: optional collaboration makes a parent-chosen family task easier, while single-caregiver families remain complete and private adult source conversations stay private.

Relationships:

- Direct dependency: gh#606, per-adult privacy foundation and program gate.
- Shared capability: gh#546 provides native system sharing while remaining owned by gh#534.
- Separate neighboring work: gh#529 owns public community discovery and is not a caregiver-collaboration child.

Genuinely new children:

- Adult invite and access center with plain shared-versus-private scope.
- Shared family action receipts and caregiver handoff queue.
- Contextual caregiver invitation from a real family task.
- Outcome-earned external referral without account-access pressure.

### Genuinely new children under existing owners

Under gh#299:

- Native bootstrap recovery for family, AI-consent, and billing-gate states.
- Native offline and interrupted-state contract for safe cached state and draft recovery.
- Native capture-to-verified-outcome event contract and parity guard.

Under gh#534:

- Certify spoken turn, tool effect, playback, interruption, audio route, and recovery on physical hardware.

Under gh#299, with evidence consumed by gh#308:

- Native accessibility acceptance gauntlet and fixes.
- Native performance budgets and release telemetry.
- Five-mom award journey study and evidence package.
- Rule and prototype iPad, orientation, and supported appearance.
- Haptics, motion, sound, and Homa state language with accessible equivalents.

The analytics child owns the typed event schema, app and web parity guard, validation, and full-loop definitions. gh#532, gh#304, gh#347, gh#392, and gh#394 consume that contract for their own product questions.

### Tracker reconciliation exceptions

- gh#543 closed through PR #561 while physical-device Print and Share selection remained unchecked. The implementation stays closed; gh#538 and gh#546 own the destination proof, and the state-packet journey must be included in their fixtures.
- gh#544 closed through PR #566 without a real-iPhone Voice journey in its closing evidence. The implementation stays closed; the new physical Voice certification child owns that missing final-path proof.

## 11. Priority order

### P0: Trust before invitation

1. Ship and verify gh#606 without letting a stale request from an old access grant become valid after an adult is removed and re-added, and without interrupting live traffic.
2. Prove one real spoken turn, tool effect, playback, interruption, and recovery on a physical device.
3. Eliminate startup, AI consent, and billing-gate infinite waits.
4. Prove no silent chat turn and no cross-surface history loss in the release app.

### P1: One complete reason to love Homa

1. Native first-family win.
2. Today with at most three useful priorities.
3. Evidence-first Progress with one next move.
4. The full Voice-to-object-to-approved-outcome loop.
5. For eligible families that choose collaboration, contextual caregiver invitation and handoff.
6. Closed-loop instrumentation.
7. Accessibility parity on every P1 journey.

### P2: Native leverage and award finish

1. Push receipts and warm-family brief.
2. Widget and deep-link shortcuts.
3. Offline-readable family state and safe recovery.
4. iPad, orientation, dark appearance, and localization expansion.
5. Rich motion, haptics, and sound after reduced-motion and screen-reader equivalents.
6. App Store story, review package, and launch loop.

## 12. Gauntlet loop

Each epic repeats this loop until every gate passes. A screenshot or unit test alone never passes a journey.

### Round 1: Parent comprehension

- Can five moms explain what this surface is for after five seconds?
- Is one primary action obvious?
- Can they predict what Homa will save, send, print, schedule, or share?
- Can they recover without a command cheat sheet?

### Round 2: PM value

- Does the feature complete a real homeschool job?
- Does it reduce preparation, coordination, uncertainty, or clerical work?
- Is the next return reason tied to real family value?
- Would removing the feature hurt the closed loop?

### Round 3: UX state coverage

- Run every state in section 5.
- Interrupt the app with backgrounding, a phone call, audio-route change, expired session, weak network, and duplicate tap.
- Confirm the useful prior state remains visible.

### Round 4: Trust and privacy

- Run two adults in one family, remove and re-add, stale in-flight requests, deletion, and legacy data.
- Show destination and scope for every external or durable effect.
- Confirm memory, raw evidence, and family state each follow their own visibility rule.

### Round 5: Accessibility

- VoiceOver order and announcements.
- Largest supported Dynamic Type without clipping or horizontal traps.
- Increased Contrast and Differentiate Without Color.
- Reduce Motion and no essential animation-only meaning.
- 44-point targets, one-handed reach, keyboard focus where relevant, and plain error language.

### Round 6: Craft

- Remove equal-weight cards and redundant labels.
- Confirm every empty state demonstrates value.
- Confirm Homa's character expresses system state, not decoration.
- Read copy aloud and remove anything that needs a second read.
- Compare every illustration, material preview, and transition against the family references.

### Round 7: Retention and optional collaboration

- Does the completed outcome set up a useful next visit?
- Is recovery kinder and easier than abandonment?
- Does the single-caregiver journey retain its full value?
- For an eligible parent-chosen task, would another adult make the outcome better?
- Is caregiver membership, one-off sharing, or external referral the least access needed?
- Is any invitation contextual, privacy-clear, optional, and non-coercive?

### Round 8: Release proof

- Tests pass at deterministic boundaries.
- Release build passes on a physical device.
- Production alias or distributed build matches the tested commit.
- Analytics show the entire loop.
- The five-participant diagnostic usability pass follows the protocol below and passes.
- The issue closes with final-path evidence.

### Diagnostic usability protocol

Five participants can expose usability failures but cannot establish population-wide demand. The pass intentionally includes a single-caregiver household, a multi-caregiver household, at least two child-age bands, different levels of technical confidence, more than one supported iPhone size, and at least one participant who regularly uses an accessibility setting.

Each participant attempts the same five priority journeys without a command cheat sheet. A journey passes when at least four of five complete its primary outcome without moderator rescue, all five can state what Homa saved or sent, and no participant encounters a privacy crossover, silent failure, or irreversible mistaken action. Any trust or privacy failure is an automatic no-ship regardless of the aggregate.

## 13. Current no-ship findings

### Trust blocker

gh#606 is a confirmed production privacy failure. The safe design requires immutable adult identity plus a durable identifier for the exact access grant across messages, episodes, thread bindings, deliveries, attachments, calls, raw progress evidence, Eve sessions, Realtime sessions, receipts, phone links, and relevant telemetry. A re-added adult must not silently regain private history from a previous access grant unless the founder explicitly approves that rule.

### Activation blockers

- Native onboarding is not complete.
- Password reset is absent.
- A fresh OAuth user can exist without a family and require browser recovery.
- Initial AI consent loading has no reliable failure escape in the current component.

### Core-loop blockers

- The app has no Today.
- Mobile and web chat history can diverge.
- Progress does not lead to a useful next action.
- Native loop analytics are too sparse to prove activation or retention.

### Award-proof blockers

- Real spoken exchange remains unproven on physical hardware.
- No complete accessibility evidence package exists.
- No five-mom journey test exists.
- No final App Store narrative shows Homa's differentiated loop.

## 14. Unknowns that require evidence or a ruling

### Discover with product evidence

- Which entry intent is most common: make, plan, log, ask, or recover?
- Where do families abandon the first useful action?
- Which Planner density is real family data versus a fixture artifact?
- Which proactive task gets opened and acted on?
- Which materials are printed, reused, or shared?
- Which adults already use multiple surfaces and experience history loss?
- For how many families is optional caregiver collaboration relevant, and for which tasks?

### Test with moms

- Does Voice auto-start feel helpful, surprising, or unsafe in a family room?
- Is Today more valuable as “what is next,” “what changed,” or “what Homa can handle”?
- Does “Progress” feel like judgment, documentation, reassurance, or planning?
- Which off-screen outcome creates the first unmistakable win?
- What would a mom naturally hand to an authorized caregiver?
- What would a mom voluntarily share with another homeschool family without granting account access?
- Which Homa character states feel alive versus distracting?

### Founder rulings

- When an adult is removed and later re-added, does the new access grant restore private history from the old grant?
- What cadence and delivery channels are approved for the weekly progress check-in?
- What family records remain readable after cancellation?
- Is dark appearance a launch requirement or an explicit post-launch choice?
- When does iPad become a supported native target?

## 15. Exit criteria

Homa can call this program award-caliber only when all of the following are true:

- The production privacy P0 is fixed, deployed, migration-verified, and adversarially probed.
- A fresh mom can install, become family-ready, and complete a useful outcome in under five minutes without leaving native.
- Voice, text, and visual object context continue as one conversation.
- Today answers what matters now in one glance.
- Progress starts with evidence and a next move, not an age-gap verdict.
- Every durable or external effect has preview, truthful completion, and appropriate undo.
- The five priority journeys pass with five moms and no command cheat sheet.
- Every priority journey passes the complete accessibility matrix.
- The release build passes physical-device voice, print, share, calendar, recorder, interruption, and weak-network tests.
- Closed-loop analytics show activation, repeat value, and trust failures without counting access grants as homeschool outcomes.
- The complete single-caregiver journey passes. For families that choose another authorized adult, collaboration adds measurable task value without exposing private raw conversation.
- App Store materials communicate the product in one sentence and show the capture-to-outcome loop.
- No issue closes on repository presence, a simulator screenshot, or an agent claim alone.

The durable product thesis is simple:

> Homa wins when a mom can speak one ordinary sentence in the middle of family life and end with the right next step, the right artifact, and the right family record, while staying fully in control.
