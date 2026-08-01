# Co-founder feedback intake: positioning, community, Binder, and activation

> Status: INTAKE SPEC, 2026-08-01. Source: co-founder notes supplied by Sidney
> on 2026-08-01. This document translates the notes into testable problems,
> user stories, build requirements, and founder questions. It does not record
> a founder ruling and does not claim any proposed behavior is shipped.

## Outcome

The notes contain six distinct product concerns:

1. The public site looks credible, but its words are not persuading visitors.
2. The early product state might be more trustworthy when framed as a bounded
   founding membership with real influence, rather than hidden or apologized
   for.
3. Families need one clear place to ask for help and report a problem. A larger
   member community is a separate, much less defined product.
4. Families want to find materials at scale and make a new version from a page
   they already like.
5. Some families do not reach or start a useful conversation with Homa. The
   current empty-state prompts may not solve the actual activation break.
6. Web chat, mobile chat, SMS, dictation, and phone calls do not yet read as one
   coherent relationship with Homa.

The fastest credible sequence is:

1. Publish the already-approved website copy once its exact source text is
   supplied.
2. Add a private, in-product problem-report path.
3. Measure the path into chat and the first useful send before redesigning it.
4. Add Binder-to-Homa revision from an exact saved material.
5. Rule the founding-membership contract, Binder folder behavior, starter
   template product, community scope, and channel promise before building the
   larger ideas.

## What the notes mean in product language

| Note | Underlying user problem | Proposed solution status |
|---|---|---|
| “Copy isn't landing” | Visitors do not understand or believe the value quickly enough | Valid problem claim, but no conversion evidence or approved replacement text was supplied here |
| “Founding member” | Early adopters need a reason to accept rough edges and a meaningful role in Homa's development | Positioning hypothesis plus a pricing and service commitment that needs a founder ruling |
| “Revive the community” | Families lack an obvious support and peer connection path | The private support need is clear. The social product, moderation model, and safety boundaries are not |
| “Front-end library” | Families want generated materials to stay findable and reusable | The Binder already exists on web and mobile. The remaining need is organization and reuse, not a new rendering library |
| “Folders by subject and child” | A flat collection becomes hard to scan as it grows | Child scope and subject filters already exist. Custom collections and manual ordering are the unbuilt part |
| “Update this worksheet” | A parent wants continuity from a liked page instead of starting from scratch | Implementable with the existing exact material lookup, reference-image path, and append-only revisions |
| “Blank chat is daunting” | Families are not reaching a first useful Homa action | Web and mobile already show three starter prompts. Reach, relevance, and first-send conversion need measurement |
| “Homa flying around” | First-time users may need stronger orientation and personality | One possible treatment, not yet evidence that animation is the missing mechanism |
| “First two weeks tutorial messages” | Families may not discover Homa's useful jobs during the activation window | Overlaps the existing onboarding drip and mobile push work. Needs consent, cadence, eligibility, and stop rules |
| “Too many ways to talk” | The channels feel fragmented and may lose context | A channel strategy decision plus continuity work, not simply a navigation cleanup |

## Current repository reality

- Marketing copy is repository-owned. The primary shared strings live in
  `apps/web/components/marketing/landing-content.ts`, with additional FAQ copy
  in `apps/web/components/marketing/faq-items.ts`. Cosmo ingests references and
  curricula into the materials pipeline. There is no verified Cosmo-backed
  runtime content manager for the public website.
- The public site already says “By homeschoolers, for homeschoolers.” New copy
  should sharpen and prove that story rather than duplicate it.
- The Binder is live on web and mobile. It already has child association,
  child-scoped viewing on web, subject and kind filters, search, recent items,
  previews, and print links. Mobile still lacks the web's per-child view context.
- The earlier portfolio review already specified FS-5 Collections v1 and left
  FD-2 open: Homa-managed folders only, or parent create, rename, and drag UI.
- The materials system already supports exact tenant-scoped lookup by material
  id, stored HTML reuse, reference images, character or theme swaps,
  `revisesId`, and a visible version rail. Restore of a prior version is tracked
  separately in gh#390.
- Web and mobile chat already offer these opening prompts: “What should we work
  on this week?”, “Make a worksheet for today”, and “We had a rough morning,
  help me reset.” Dynamic next-message suggestions also exist after replies.
- Onboarding drip decisions are already tracked in gh#188. Native push and its
  consent policy are tracked in gh#307.
- Phone quality and demand are being evaluated in gh#287 and gh#275. Cross-
  surface and voice continuity defects are tracked in gh#493, gh#494, and
  gh#496. Chat history browsing is gh#179.

## User stories

### US-1: Understand Homa before signing up

As a homeschool parent considering Homa, I want the website to describe one
specific burden Homa removes and show believable proof, so I can decide whether
the trial is worth my time.

### US-2: Join as a founding member with clear terms

As an early paying family, I want to know exactly what “founding member” gives
me, how long it lasts, and what Homa is still learning, so exclusivity does not
come at the cost of billing trust.

### US-3: Report a problem privately

As a parent who finds something wrong, I want a visible problem-report path that
acknowledges my report and carries enough context for Homa's team to investigate,
so I do not have to guess where to send it or post family information publicly.

### US-4: Connect with other Homa families safely

As a Homa member, I may want to share resources, discuss homeschooling, or find
meetups, but I need to know who can see the space, who moderates it, and how my
children's information is protected.

### US-5: Find saved materials as the Binder grows

As a parent with many saved materials, I want to browse by child and subject and
optionally group pages into named collections, so finding a keeper does not
become another filing chore.

### US-6: Arrange a collection in a useful order

As a parent preparing a sequence or packet, I want to move a material into a
collection and order the collection, so it matches the order in which we will
use or print it.

### US-7: Make a new version from a keeper

As a parent viewing a saved worksheet, I want to ask Homa to keep its structure
while changing the topic, numbers, level, or character, so I can build on
something my child already liked.

### US-8: Start with an intention, not an empty prompt

As a parent who is unsure what to type, I want a few concrete starting actions
that use what Homa already knows about my family, so I reach a useful result
without learning prompt writing.

### US-9: Learn Homa through real work

As a new member, I want help at the moment a feature becomes relevant, with a
clear way to dismiss it, so the product teaches me without forcing a tour.

### US-10: Talk to one Homa across channels

As a parent who moves between the app, text, and a call, I want Homa to retain
the durable facts and work products she is allowed to retain, so changing the
transport does not feel like changing assistants.

## Buildable requirement packages

### Package A: Approved website copy publication

Problem: The exact approved pitched text is not in these notes, and Cosmo is not
the verified publishing path for the marketing site.

Requirements:

- Attach or link the exact approved source text, with a named approver and date.
- Map every approved passage to a real surface: hero, proof, founder story, FAQ,
  membership offer, or call to action. Do not paste one long pitch into every
  section.
- Keep one repository source for shared copy. Update component tests that assert
  the current strings.
- Verify every capability and price claim against current product and billing
  behavior. Do not promise community, templates, cross-channel memory, or a
  founding rate before those contracts are approved and available.
- Run `homa-copy-reviewer`, then `homa-copy-editor`, then the relevant web tests,
  build, deployment check, and live mobile-width readback.

Acceptance criteria:

- A visitor can answer in one scan: who Homa is for, what Homa does today, what
  the trial costs, and what proof is available.
- The deployed page matches the approved source and contains no unshipped claim.
- The exact old and new primary conversion copy is recorded so conversion can be
  compared rather than attributed to a bundle of unrelated changes.

### Package B: Founding membership decision and implementation contract

Problem: “Low price forever” is not merely copy. It is a durable billing,
support, legal, and cross-platform promise.

Decision requirements:

- Define eligibility: existing families, first N paid families, purchases before
  a date, invitation only, or another exact rule.
- Define the benefit: fixed dollar price, fixed discount, or access to a named
  plan. A fixed plan name does not guarantee future features.
- Define continuity: whether cancellation, failed payment, plan changes, refunds,
  or account deletion end the guarantee.
- Define scope: one family, number of adults and children, taxes, add-ons, and
  future higher tiers.
- Define availability in Stripe and Apple subscriptions. A web-only founding
  promise must not silently become an App Store promise.
- Define the finite “help shape Homa” mechanism, such as a monthly feedback call,
  a private feedback board, or structured votes. Do not imply product control.
- Obtain counsel review of “forever,” scarcity, testimonial, and material-change
  wording before publication.

Technical requirements after the ruling:

- Persist founding eligibility and the granted commercial terms as durable
  server-owned entitlement data. Do not infer them from mutable marketing copy.
- Webhooks remain the authority for purchase state. A client cannot grant itself
  a founding tier.
- Admin and support surfaces show why a family has the rate and whether it is
  active.
- Checkout, receipt, account management, FAQ, Terms, and cancellation behavior
  say the same thing.
- Add tests for eligibility boundaries, renewal, failed payment, cancellation,
  resubscription, upgrade, downgrade, refund, and provider reconciliation.

### Package C: Private problem reporting

Problem: Families have no single, explicit product path for troubleshooting and
bug reports.

MVP requirements:

- Put a visible “Report a problem” action in Help or Settings and near failure
  states where appropriate.
- Collect a category, short summary, optional detail, and optional screenshot.
  Offer to attach the current page, app version, and a content-free diagnostic
  identifier. Never attach conversation or child data without a separate, clear
  choice.
- Derive family and reporter identity from authentication. Never accept a
  client-chosen family id.
- Store screenshots privately with retention and deletion rules. Reports remain
  private by default.
- Return a receipt with a report id and set an honest response expectation.
- Give authorized Homa operators a triage view with status, severity, duplicate
  link, and sanitized escalation into the engineering tracker.
- Emit submitted, acknowledged, resolved, and reopened events.

Out of scope for the MVP:

- A public forum, voting leaderboard, public roadmap, live chat support, or
  automatic publication of family reports to GitHub.

### Package D: Binder collections and ordering

Problem: Subject and child browsing exist, but custom grouping and order do not.

Recommended v1 model, pending the FD-2 ruling:

- Keep child and subject as existing views. Do not create duplicate physical
  folder trees for facts already stored on each material.
- Add family-scoped named collections for meaningful sets such as “Butterfly
  unit” or “Letter practice.”
- Each material belongs to zero or one custom collection in v1. This matches
  physical folder behavior and keeps move semantics understandable. Revisit a
  many-to-many label model only after real demand.
- Store an explicit position within a collection. Dragging changes order or
  moves a material between collections through an authenticated, tenant-scoped
  write.
- Parents can create, rename, and reorder if the latest note is accepted as the
  FD-2 ruling. Homa can create and file through the same narrow deterministic
  operations when asked in chat.
- Collection deletion never deletes materials. Moving or removing a material
  never mutates its revision history.
- Web and mobile read the same collection model. If drag is web-first, mobile
  must still browse the correct ordered result.
- Add typed events, RLS policies, tenant-isolation fixtures, idempotent move
  semantics, and concurrent reorder coverage.

Acceptance criteria:

- A parent can create “Butterfly unit,” move three existing keepers into it,
  arrange them, reload, and see the same order.
- A child-scoped view never exposes another family's collection or a sibling-only
  material outside the existing family view rules.
- Homa can fulfill “Put the new page in our Butterfly unit” only inside the
  authenticated family.

### Package E: Revise from Binder

Problem: The system can revise an existing material, but the parent-facing
Binder does not make that path obvious or carry the selected keeper into chat.

Requirements:

- Add “Change this with Homa” on a material detail surface.
- Carry the selected material's exact id through a server-validated family
  context into chat. Do not depend on title search or trust an unscoped client id.
- Prefill a plain-language request such as “Keep this layout, but...” while
  letting the parent edit before sending.
- The materials-studio skill fetches the exact material. HTML pages reuse stored
  structure. Image-led pages pass the retained preview as a reference and state
  explicitly what stays and what changes.
- Every result is a new append-only revision using `revisesId`. The source remains
  visible in the version rail.
- Normal quality review, parent approval, print, and Binder finalization rules
  remain unchanged.
- Multi-page packets support changing one page without retyping the others.
- Track revision-started, first-preview-ready, approved, abandoned, and restore
  events, joined to the source material without logging its content.

Acceptance criteria:

- From a kept Kirby math page, a parent can request the same structure with a new
  math topic or approved character treatment and receive a new linked version.
- A refresh preserves both versions and the version rail explains their order.
- A material id from another family fails closed.

### Package F: Chat reach and first-use activation

Problem: The notes report that users are not reaching chat. Adding different
starter buttons cannot fix a navigation or onboarding drop-off.

Inquiry requirements:

- Instrument the path from authenticated app entry to chat viewed, opening
  prompts shown, opening prompt tapped, first message sent, first assistant reply,
  and first completed useful action.
- Separate web, iOS, new family, returning family, and child-scoped use.
- Establish a current baseline before changing prompt labels.
- Review at least five real failed or stalled journeys, with consent and
  content-minimizing evidence, to distinguish these hypotheses:
  1. Families do not see the chat entry.
  2. Families see chat but do not know what Homa can do.
  3. The three current prompts are too generic or mismatched.
  4. Latency or lost-turn defects make the first attempt look unsuccessful.
  5. Families prefer voice or another surface for the same job.

Smallest useful treatment if prompt relevance is the cause:

- Test an intent-led opening set: make a worksheet, plan a lesson, build a unit
  study, or something else.
- A tap starts useful work with known child context. It does not open a long
  tutorial or force the parent through a template wizard.
- If one choice is needed, ask one compact follow-up such as child or theme. Homa
  should make a sensible first version and offer changes after there is something
  concrete to react to.
- Compare first-send and first-useful-action rates against the existing three
  prompts. Do not ship a broad tutorial from click-through alone.

Animation requirements if tested:

- Use Homa's existing character and motion system.
- Be contextual, brief, dismissible, keyboard and screen-reader safe, and never
  obscure the composer.
- Respect Reduce Motion with a still or fade-only alternative.
- Play once per relevant teaching moment, not on every visit.

### Package G: Starter template product decision

Problem: “Samples by grade” could mean three different products with different
data, review, and UI requirements.

Options to rule:

1. Prompt starters only. A small gallery sends a well-formed request to Homa.
   Cheapest and always personalized, but the parent cannot preview the result.
2. Sample artifacts. Families preview polished examples, then ask Homa to make
   one for their child. Strong proof, but samples need versioned editorial review.
3. Cloneable templates. Homa preserves a reviewed layout and swaps level,
   content, and theme. Strongest consistency, but requires a governed template
   catalog and compatibility rules.

Minimum requirements for any option:

- Use age or grade bands only as a starting point. The child's current skill and
  parent request outrank a generic grade label.
- Distinguish worksheet, lesson plan, and unit study. They have different output
  contracts and must not all become printable worksheets.
- Every public sample is reviewed, versioned, and tied to a real generation path.
- Track preview, choose, generation success, keep, print, and repeat use.
- Start with a narrow, measured set. Do not author every subject and grade before
  proving that samples improve first useful action.

### Package H: First 14-day guidance

This extends gh#188 and gh#307 rather than creating a second drip system.

Requirements before implementation:

- Decide eligible channels and obtain the required consent for each.
- Define a hard maximum cadence, quiet hours, stop and unsubscribe behavior, and
  one owner per family.
- Eligibility is deterministic and state-based. Do not offer a worksheet tutorial
  after the family has already made and kept one.
- The model may personalize the words from bounded family context. Code decides
  eligibility, caps, idempotency, tenancy, and delivery.
- Every message offers one relevant action, never guilt, streak pressure, or a
  vague “come back” nudge.
- Stop the sequence when onboarding is incomplete for a more urgent reason, the
  family opts out, the promised action is already complete, or delivery fails.
- Measure action completion and unsubscribes, not opens alone.

### Package I: One Homa across channels

This is a strategy input to gh#287, gh#275, gh#280, gh#493, gh#494, gh#496,
and gh#179. It is not a new channel implementation.

Requirements for the decision:

- Name the default experience. The current evidence points toward the native app
  as the likely home once onboarding, billing, and continuity are proven there.
- Name the job of each remaining channel. For example, SMS may be capture and
  delivery, while phone may be high-bandwidth conversation. Do not keep channels
  merely because they exist.
- Measure real use, successful outcomes, cost, and continuation across surfaces.
- Define what must follow the family across channels: durable facts, accepted
  tasks, materials, and conversation summaries. Raw audio retention remains a
  separate consent decision.
- Do not remove a channel until affected families have a migration path and the
  replacement succeeds in production.

## Questions that block implementation

Ordered by blast radius.

### Founding membership

1. Is “low price forever” a fixed dollar price, a fixed percentage discount, or
   access to a named plan at its original price?
2. Who qualifies, and what exact event or date closes the founding cohort?
3. Does canceling, missing payment, changing plans, or deleting the account end
   the founding rate?
4. Does the promise apply to Apple purchases as well as Stripe web purchases?
5. Which future features or higher tiers, if any, are explicitly excluded?
6. What concrete influence do founding members receive, and who makes the final
   product decision?
7. Has counsel approved the use of “forever” and limited-availability language?

### Community and support

8. Is the first goal private support, peer discussion, resource exchange,
   meetups, or all four? Which one must work first?
9. Is community access paid-member only, invited families only, or public?
10. Who moderates posts, handles reports, and responds during nights or weekends?
11. May users post child names, photos, schoolwork, locations, or meetup details?
12. Are meetups merely discussed, or does Homa host, recommend, or verify them?
13. Should problem reporters see status updates, or is an acknowledgement enough
    for v1?

### Binder and material reuse

14. Does the latest request overrule FD-2 and approve parent create, rename, move,
    and drag behavior, or should Homa still manage collections through chat only?
15. Can one material belong to more than one custom collection?
16. Does drag mean reorder inside a collection, move between collections, or both?
17. Should custom collections be family-wide, child-specific, or either?
18. When a parent says “same layout,” which qualities must be locked: page
    geometry, colors, art style, exercise count, wording pattern, or all of them?
19. Are faithful third-party characters allowed only under the existing legal
    decision tracked in gh#449, or should the feature use generic themes by default?

### Chat, tutorials, and samples

20. Which observed families did not reach chat, and at what step did they stop?
21. Is the requested redesign for web, iOS, or both?
22. Should “Worksheet / Lesson / Unit Study / Something Else” replace the three
    current prompts or appear as a second level after one prompt?
23. Is “template” a prompt starter, a previewable sample, or a cloneable governed
    layout?
24. Which age or grade bands and subjects form the smallest useful launch set?
25. Should tutorial animation teach navigation, demonstrate Homa's personality,
    or trigger a real first task? Only one should be primary.
26. Which channel may carry first-14-day guidance, and what send cap is acceptable?

### Channel promise and voice

27. Is the intended product app-first with SMS and phone as complements, or should
    one of those channels be retired?
28. Which channel currently produces “better responses,” and what evidence defines
    better: completion, parent rating, fewer revisions, or conversation depth?
29. When the notes say voice does not retain the conversation, do they mean the
    phone call, in-app realtime voice, web dictation, or all voice paths?
30. What must be retained from voice: transcript, summary, durable decisions,
    created artifacts, or raw audio?

## Ticket map

| Work | Tracker | Treatment |
|---|---|---|
| Publish approved website copy | gh#526 | New issue, blocked on exact approved source text |
| Founding membership contract | gh#527 | New founder-decision issue |
| Private problem reporting | gh#528 | New buildable feature issue |
| Community MVP and safety model | gh#529 | New investigation and founder-decision issue |
| Binder collections and drag ordering | gh#530 | New feature issue activating FS-5 and FD-2 |
| Revise a kept material from Binder | gh#531 | New feature issue, uses existing material primitives |
| Chat reach and starter-action effectiveness | gh#532 | New investigation issue before UI expansion |
| Starter template product | gh#533 | New investigation and founder-decision issue |
| First 14-day guidance | gh#188 and gh#307 | Add this feedback as evidence, do not duplicate |
| One Homa across channels | gh#287 and gh#275 | Add this feedback as strategy evidence, do not duplicate |
| Conversation and voice continuity | gh#493, gh#494, gh#496, gh#179 | Existing implementation and bug issues |
| Restore a prior worksheet version | gh#390 | Existing issue, adjacent but not duplicate |
| Persist a proven family generator | gh#398 | Existing later capability, not required for Binder revision v1 |

## Explicit non-goals for this intake

- No community network is approved by this document.
- No founding price or “forever” promise is approved by this document.
- No production behavior is inferred from a repository file or prior plan.
- No large grade-by-grade content library should be built before the starter
  product and activation signal are chosen.
- No channel is removed, and no raw audio retention rule is changed.
- No new material generation engine or front-end rendering library is needed for
  the requested worksheet revision path.
