# Category-leader landing page design

> **Status:** APPROVED FOR IMPLEMENTATION
>
> **Source:** `directed-paths-vs-homa-teardown.canvas.tsx`, approved by the founder on 2026-07-15.
>
> **Goal:** Make `thankshoma.com` explain Homa's category, interaction model, and shipped product value within one phone screen, then prove each major claim with truthful product UI.

## Product position

Homa is the homeschool assistant that does the prep.

Management apps ask a parent to plan, log, upload, and organize. Homa lets the parent talk naturally, then makes useful work, keeps the record, and shows what comes next.

The page must make three ideas clear:

1. Homa is an AI assistant for homeschool parents, not a child-facing tutor.
2. A parent can talk with Homa by text message or web chat from a phone.
3. Homa does concrete work: practice pages, weekly plans, binder organization, hours records, and progress reports.

## Experience principles

- Show the product before describing the product.
- Use fixture-safe examples only. Never use a real family's names, messages, photos, or work.
- Use national standards for the progress report. State data is a separate homeschool-rules reference.
- Do not imply App Store availability. The platform language is `Text message`, `Web chat`, and `Phone friendly`.
- Do not publish pricing, a founding-family rate, family counts, testimonials, or founder photos without the existing founder and evidence gates.
- Do not market community, state academic mapping, local discovery, or curriculum import as shipped.
- Keep the child out of the AI interaction. The parent is always the user.
- Follow Homa's current warm-and-playful design system. Use one or two playful devices per section.

## Page narrative

### 1. Hero

The hero opens with:

- Eyebrow: `AI help for homeschool parents`
- Headline: `The homeschool assistant that does the prep.`
- Body: two sentences that name Homa as an AI assistant for parents and state the four core jobs.
- Primary action: `Get started for free`, preserving the current signup popup.
- Secondary action: `See a sample report first`, linking to `/onboarding/sample`.
- Platform strip: `Text message`, `Web chat`, `Phone friendly`.

The visual is a fixture-labeled phone conversation. A parent asks Homa for butterfly-themed letter B practice. Homa replies that the page is ready to print and saved in the binder. A printable preview sits inside the conversation. This is rendered product UI, not an invented product screenshot.

### 2. Parent pain bridge

A short section names four jobs without turning the page into an anxiety funnel:

- Sunday-night planning
- Wondering if it is working
- Everything scattered
- Hours and state forms

The section closes with the concrete category line: Homa handles the prep, recordkeeping, and follow-up.

### 3. Concrete capabilities

Replace the six equal abstract cards with four plain product nouns:

1. `Practice pages`
2. `The weekly plan`
3. `The binder`
4. `Hours and state paperwork`

Each capability includes a fixture-safe UI proof that matches the shipped product vocabulary. The section does not claim local discovery, curriculum comparison, curriculum import, a native app store listing, or automated legal compliance.

### 4. Free progress report proof

Promote the existing `ReportPreview` into the main page immediately after the concrete capabilities. The copy explains the mechanism at the first progress claim:

- The parent answers a five-minute questionnaire.
- Homa checks the answers against national standards and research.
- Strengths come first.
- Anything still growing comes with a next step.

The sample report is a first-class action, not fine print.

### 5. How Homa works

Keep the existing four-step thread after the product proof. Its final step uses the same progress-report mechanism and vocabulary as the promoted sample section.

### 6. Founder story

Keep the current story band. Rewrite any copy that calls Homa a curriculum or uses retired report-status language. Add the public co-founder signature `Alessa & Carolyng`.

Do not add faces until a founder-approved photo asset and consent exist.

## Tickets

### LP-01: Category hero

**Scope:** New headline, two-sentence explanation, signup CTA, sample-report CTA, platform strip, and truthful phone conversation.

**Acceptance:**

- The first 844 CSS pixels on a 390px phone show the category, the primary CTA, the sample path, and at least the start of the product conversation.
- The phrase `Works by text` or equivalent is visually readable without opening a menu.
- The product visual is labeled as an example.
- No real family data appears.

### LP-02: Parent pain bridge

**Scope:** Four concise pain items between the hero ribbon and capabilities.

**Acceptance:**

- Each item is one heading and one sentence.
- The section does not say `You need help` or contradict the platform strip.
- The section reassures before it introduces the product answer.

### LP-03: Concrete capability proof

**Scope:** Four capability tiles with product UI proof.

**Acceptance:**

- The titles are the four product nouns in this spec.
- Each proof uses fixture data and shipped vocabulary.
- The section contains no claim for community, local discovery, curriculum comparison, state academic mapping, or native App Store availability.
- Four tiles remain easy to scan on a phone.

### LP-04: Promoted sample report

**Scope:** Reuse `ReportPreview` in a dedicated landing section and explain the mechanism before the claim.

**Acceptance:**

- `/onboarding/sample` is linked from the hero, this section, and the final CTA band.
- The first progress claim says the parent answers the questionnaire.
- National standards and state homeschool rules are not conflated.

### LP-05: Honest founder story

**Scope:** Tighten the existing story and add the public co-founder signature.

**Acceptance:**

- No invented quote, result, number, photo, or testimonial.
- Homa is called an assistant, not a curriculum or co-pilot.
- The copy contains no retired whole-child status labels.

### LP-06: Copy gates

**Scope:** Run the fresh-context ICP reader gate, apply accepted notes, then run the copy editor gate.

**Acceptance:**

- The reader receives only the complete page copy in reading order.
- The editor receives the post-reader copy, the copy rulebook, and house style.
- Every accepted note is fixed at the page/component source.

### LP-07: Responsive E2E

**Scope:** Verify the full page at desktop and phone widths.

**Acceptance:**

- Desktop viewport: 1440 by 900.
- Phone viewport: 390 by 844.
- No horizontal overflow.
- Sticky navigation still works.
- Hero primary CTA opens the signup dialog.
- Hero and capability sample links open `/onboarding/sample`.
- Signup dialog closes with Escape.
- Product proof is visible with JavaScript enabled.
- Reduced-motion mode does not hide content.
- No uncaught page errors or console errors.
- Fresh screenshots record hero, product proof, and full page at both widths.

## Deferred tickets

These tickets are intentionally blocked and must not render empty placeholders:

### LP-08: Founder faces

**Blocker:** No founder-approved photo asset exists in the repository.

**Unblock:** Supply a warm, natural-light photo of Alessa and Carolyng with explicit marketing consent.

### LP-09: Founding-family offer

**Blocker:** The paywall and pricing activation remain founder-gated. Repository copy does not prove live Stripe state.

**Unblock:** Verify Stripe prices, activate the existing wall through its runbook, and approve the public founding-rate policy.

### LP-10: Real social proof

**Blocker:** No consented family quote or freshly verified aggregate count is supplied.

**Unblock:** Provide a consented quote or a reproducible aggregate query with a dated evidence note.

### LP-11: Curriculum import claim

**Blocker:** Photo understanding and planning exist, but no end-to-end production journey proves `snap your curriculum and Homa builds the year around it`.

**Unblock:** Build and evaluate the fleet procedure, verify a real upload-to-plan journey, then add the claim.

## Definition of done

The implementable tickets LP-01 through LP-07 pass local tests, typecheck, lint, build, responsive browser E2E, and the two copy gates. Deferred tickets remain absent from the rendered page and retain explicit evidence-based blockers.
