# Deep Research Notes (2026-07-02, round 2)

> Supersession note (2026-07-06, build-log): $29 and $29 to $49 plan prices
> below are the retired placeholder. Pricing v1 is Homa $19/mo or $99/yr and
> Homa Pro $49/mo, live in Stripe both environments. Competitor prices quoted
> in this doc are facts and stand. Allotments still derive at day 60 (T2).

> Source-code level findings on eve, legal obligations, compliance data sourcing, and
> generation economics. Companion to 05-vercel-platform-facts.md.

## 1. eve source-code findings (read from the published package, dist/src, v0.19.0)

### Compaction is MORE lossy than the docs imply — rotation design vindicated

Read `harness/compaction.js` directly. How it actually works:

- System prompt: generic "conversation summarizer" told to preserve "goal, important
  instructions, technical decisions, discoveries, open work, relevant tool results" in
  short labeled sections (Goal / Instructions / Discoveries / Accomplished / Next steps).
  Temperature 0.
- **Before the summarizer even runs, every message in the "older" window is truncated to
  280 characters** (`summarizeText`), and tool calls/results are squashed to shallow
  stubs like `object(3 keys)` / `array(5: …)` (depth 2, first 3 items). A long journal
  voice-note from a mom would enter compaction pre-amputated.
- Reasoning content is dropped entirely; the recent verbatim window keeps assistant TEXT
  only (tool messages stripped).
- Summary token reserve: `min(2048, max(64, threshold/4))`.
- Token counting is provider-reported when available, else `JSON.length/4` estimate.

Consequences (all already reflected in architecture, now with proof):
1. Facts must be captured to Postgres **at the turn they occur** — compaction will not
   preserve them.
2. Behavior rules must ride in instructions (never compactable) — confirmed: dynamic
   instructions are assembled per model call, outside history.
3. **`compaction.model` is configurable separately from the chat model** (verified in
   `resolve-agent.js`) — run compaction on a cheap model, it's summarizing 280-char
   stubs anyway.

### Sandbox `/workspace` does NOT survive redeploys — sandbox is scratch, never storage

Read `runtime/sandbox/keys.js`. The per-session sandbox name is:

```
eve-sbx-ses-<backend>-<scope>-<sessionId>-<nodeId>
```

where `<scope>` on Vercel is a hash of **`VERCEL_DEPLOYMENT_ID`**. Translation: every
production deploy changes the scope → existing durable sessions get a *fresh sandbox
name* on their next turn → prior `/workspace` contents are orphaned (templates are
separately keyed `eve-sbx-tpl-…` by content hash and DO survive deploys via prewarm).

Architecture consequence (upgraded from "principle" to "law"): **per-family files live in
Postgres + Blob, period.** The sandbox holds only (a) template-seeded scripts/fonts,
(b) job-scoped scratch. Any generated artifact must be uploaded to Blob before the turn
ends. With our deploy cadence (daily-ish), treating sandbox persistence as family storage
would silently wipe "the family computer" every deploy. This kills the last remnant of
the "persistent Sandbox as the Mac-Mini-in-the-cloud" idea — good riddance, we planned
around Postgres/Blob anyway.

Also verified: eve's default Vercel sandbox timeout is 30 minutes
(`DEFAULT_SANDBOX_TIMEOUT_MS = 1800*1e3`), tag limit 5, and template prewarm retries once
on cache-miss before failing the build.

## 2. Legal: COPPA 2025 amendments (compliance deadline ALREADY PASSED — April 22, 2026)

The FTC's first COPPA overhaul since 2013 was finalized April 2025; full compliance was
required by **April 22, 2026** — i.e., before our launch. What matters for Homa:

- **Scope nuance in our favor:** COPPA governs collection *from* children under 13.
  Homa v1 is parent-directed — the mom is the user; the child never touches the product
  (worksheets are printed). We collect data *about* children *from* a parent, which is
  generally outside COPPA's direct trigger. BUT: design decisions must keep it that way
  (no child-facing chat mode without a full COPPA workup), and state privacy laws (CCPA
  et al.) still treat child data as sensitive.
- **AI-training consent:** disclosures of a child's personal info to third parties "to
  train or otherwise develop AI" are explicitly non-integral and need separate verifiable
  parental consent. Our commitments must be contractual, not vibes: zero-retention /
  no-training arrangements with model providers (AI Gateway's ZDR enforcement add-on is
  relevant), stated in the privacy policy.
- **No indefinite retention + written retention policy required** — maps directly to our
  export/delete self-serve plan (M4-05); add a written retention schedule to M4-04.
- **Direct notices must identify third parties/categories** receiving data — our privacy
  policy must name model providers, Vercel, Supabase, fal.ai, Stripe, Resend.
- Ed-tech-specific rules were deferred (FTC waiting on FERPA changes) — we're
  direct-to-parent, not school-contracted, so FERPA is out of scope for v1.

**M4-04 (lawyer pass) now has a concrete brief**: confirm parent-directed posture keeps
us outside COPPA's operator trigger; write the retention policy; verify provider
no-training terms; review state-law child-data handling (CA/CO/CT/VA).

## 3. Compliance ruleset sourcing (unblocks M3-05)

The 50-state homeschool requirements table doesn't need to be hand-researched:

| Source | What | Use |
|---|---|---|
| **HomeschoolLeap** (homeschoolleap.com) | **Free public API**, 50 states + DC, sourced from state statutes with published verification method: regulation level, notification, testing, subjects, ESA availability | Primary machine-readable seed for our `state_requirements` table |
| **JHU Homeschool Hub** (Institute for Education Policy) | Academic, non-advocacy; downloadable state data; regulation history + compulsory ages | Secondary verification + citations |
| State DOE statutes | Primary sources | Final authority; link each rule to its statute like ArborSlate does ("last-reviewed" dates) |
| HSLDA | Advocacy org; detailed but **members-only** forms/resources | Do NOT scrape; fine as a comparison reference |

Plan: seed from HomeschoolLeap API → verify high-population states against statutes →
show "last verified" dates in-product (trust signal competitors already use). M3-05
estimate drops; added note to ticket.

## 4. Generation economics (fal.ai, verified pricing)

| Model | Price | Notes |
|---|---|---|
| Nano Banana 2 (what Homa uses today) | **$0.08/image @1K** ($0.06 @512px) | Gemini 3.1 Flash Image; strong text rendering; 14 reference images (character consistency for picture books) |
| Nano Banana Pro | $0.15/image | Only for hero assets |
| Seedream V4.5 | $0.04/image | Candidate for coloring pages |
| FLUX.2 [dev] Turbo | ~$0.008/image | Candidate for low-stakes decorative art |

Worksheet cost stack (verified components): sandbox compute ≈ $0.01–0.03 + one 1K image
$0.08 + LLM turn ≈ small → **≈ $0.10–0.15 per illustrated worksheet, image-dominated**.
30/month ≈ $3–4.50/family. Fine at $29–49/mo, and the image model is the cost lever
(512px for drafts, cheaper models for coloring pages). Mac Mini's "Nano Banana 2 only,
never Flux" rule was a quality call for *story-character* art — keep it for picture
books, relax it for generic clip-art.

## 5. Follow-ups spawned by this round

- [ ] M4-04 brief updated (COPPA specifics above).
- [ ] M3-05 note: seed from HomeschoolLeap API + JHU verification; statute links +
      last-verified dates in product.
- [ ] Architecture: sandbox-as-scratch law + artifact-upload-before-turn-end rule
      (written into 01).
- [ ] Cost model (M0-06): use $0.08/image, and real token numbers from the Mac Mini
      usage analysis (see 08-real-usage-cost-model.md when the analysis lands).
- [ ] Set `compaction.model` to a cheap model in the agent config from day one.
