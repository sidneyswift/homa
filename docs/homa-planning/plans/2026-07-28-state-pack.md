# The state pack: one button, every document your state asks for

Date: 2026-07-28. Status: v1 shipping today. Author: council-adjudicated
design (5 expert lenses + adjudicator), founder-directed scope.

The founder's authorization, verbatim scope: "with one button, a family
can download and print all of their state's requirements." This plan is
the settled design for that button. It supersedes nothing: the PRD's
cohort-one non-goal on the family-evidence state report stands, and that
larger feature remains a founder-decision issue.

## What ships in v1

"Your {State} pack": a per-family PDF generated on demand from the
`state_requirements` table (51 reviewed jurisdictions, HomeschoolLeap
CC BY-SA 4.0), personalized with the family data Homa verifiably holds,
downloadable and printable from one button on /app/binder.

Contents by state shape:

- All states: a cover page (trust colophon: verified date, attribution,
  boundary block, regenerate instruction) and a "Key requirements at a
  glance" page (definition rows reusing StateCard vocabulary; verbatim
  deadline strings; citations with visible URLs; case-law citations
  excluded).
- States with duties: a derived checklist page ("{State} requires: file
  your notice by {deadline} with {recipient}"), record-keeping templates
  gated strictly on typed payload booleans (attendance log per child,
  instructional-time log, portfolio index, year-end check record), and a
  notice-of-intent prep sheet (visibly not a form; prefilled complete
  values above blank labeled lines; official link printed).
- The nine zero-duty states (AK CT ID IL MI NJ OK TX WY): an affirmative
  "You are legal in {State}" page (primary statute, status citation,
  required subjects, compulsory ages) instead of checklist/templates.

## The twenty council decisions (D1..D20)

1. **Scope.** (a) informational pages + (b) blank templates from typed
   booleans + (c-lite) a prep sheet that is visibly not a form. Excluded,
   no exceptions: family-evidence compilation, official-form facsimiles,
   signature lines, pathway wizards, ESA content, case-law cites in the
   parent packet, drafted ready-to-sign NOI letters.
2. **Zero-duty states** get the affirmative legal-status pack (3 pages).
3. **pathway_varies law.** Any field with `pathway_varies=true` renders
   fixed copy ("This varies by pathway in {State}. Confirm at the
   official source.") plus the official link, and is suppressed from
   checklist derivation. `pathway_varies_detail` and
   `required_conditions` are never rendered (they contain literal
   "undefined" and embedded JSON).
4. **Verbatim prose.** Deadline strings and compulsory-education notes
   render verbatim, never parsed or normalized (a parser would drop NY's
   mid-year clause). Unit test pins NY's string.
5. **Prefill.** Silently prefill only complete values (family name,
   parent name when both parts present, child first names, birthdates,
   state). Partial values render as fully blank labeled lines. Never
   derive grade from birthdate, never infer school-year dates, never
   borrow the parent's last name for a child. No form at the button.
6. **Surface.** StatePackCard atop /app/binder: "Get your {State} pack",
   spinner pending state, calm not-ready copy for null state or missing
   row. `compliance.ruleset_viewed` emits server-side on card render.
7. **Shape.** Four new modules, no eve tool, no skill, no model call:
   payload reader beside the summary reader; pure derivation/render in
   `apps/web/lib/compliance/pack.ts`; `POST /api/compliance/pack`; the
   card component. Downloads ride the existing authenticated
   `GET /api/materials/[id]/pdf`.
8. **Persistence.** Each generation is a new immutable finalized
   materials row: kind `packet`, child_id null, channel `web`, subject
   `state-pack`, `revises` chaining to the prior pack so Binder shows
   one current pack and prior rows persist as receipts (J-H blast
   radius). Short pack id printed in the footer.
9. **Staleness.** Always regenerate fresh; require
   `verification_status='verified'`; non-empty `stale_claim_ids` adds a
   calm re-verification banner, never a refusal. Cover always prints the
   regenerate instruction.
10. **Stamping.** Sibling wrapper `wrapStatePackDocument` (same page-box
    geometry, different footer): house mark + "Prepared with Homa for
    the {family} family" left; "sources verified {Mon YYYY} · made
    {date} · pack {id} · page N of M" right. Info pages add "Legal
    information, not legal advice · data: HomeschoolLeap, CC BY-SA 4.0".
    Template pages omit the legal line but restate their triggering
    requirement (with verified date) in the header, so AQ-10 holds on
    every page. Read of the D7 ruling: "made with Homa for {child}"
    governs child-addressed materials; this family-level artifact is
    outside its scope. Recorded for founder ratification (gh issue).
11. **Wording.** The boundary and attribution blocks ship today as
    interim wording adapted from the founder-vetted StateCard sentences
    (exact text in §Wording below), recorded here and appended to the
    M4-04 brief. Never labeled lawyer-reviewed.
12. **Vocabulary.** The feature is "Your {State} pack". The words
    "compliance", "compliant", "approved" never appear in parent-facing
    copy. `regulation_level` is never printed; high-regulation states
    get a calm limits callout pointing at the DOE and district.
13. **Validation.** Do not call `validatePrintableHtml` (BANNED_WORDS
    bans "assessment", which statutes require; the pack is code-authored
    with no model in the loop). Instead: `sanitizeReferenceText` on
    every payload string at parse time, `escapeHtml` at render time,
    unit assertions of no em dash and no script tag in rendered output.
14. **Events.** All four registered and live in this PR:
    `compliance.ruleset_viewed` {state, has_verified_date},
    `compliance.report_requested` {state},
    `compliance.report_generated` {state, latency_ms, page_count},
    `compliance.report_downloaded` {state}. Row 48's period enum is
    dropped (it described the retired evidence-report concept);
    journeys/06 rows 47-50 updated in the same PR.
15. **Page counts.** No hard cap, no truncation ever. Deterministic page
    budgets with spill-to-continuation logic; attendance is one page per
    child; post-render assertions that page count matches plan.
    Worst-case fixture: 6-child PA family renders overflow-free.
16. **Design.** White pages (never cream), hairline stone rules, clay
    accent under 5% coverage, grayscale-safe, meaning never encoded in
    color. Brand faces via allowlisted Google Fonts (Schibsted Grotesk,
    Hanken Grotesk, JetBrains Mono for dates/citations/URLs), real Logo
    art in headers, one sage Caveat note on the checklist only. Prep
    sheet: two-column, boxed "this is not the form" block, no signature
    line.
17. **Paywall.** Included in the trial; no additional gate.
18. **Citations filter.** Statutes/regulations/DOE pages with visible
    URLs; `case_law` entries excluded from the parent packet, status
    citations kept only on the zero-duty legality page.
19. **Test wall.** Derivation goldens across all 51 snapshots; deep
    fixtures PA, NY (mid-year clause pinned), CA (object-shaped
    citation_urls), TX (zero-duty), SC (notification, null deadline);
    6-child overflow fixture; no-em-dash/no-script assertions;
    empty-table and null-us_state paths; check:isolation, check:events,
    typecheck, lint. One physical print + one grayscale photocopy of a
    real state before shipping.
20. **Everything excluded goes to issues**, filed the same day; only
    genuinely blocked items carry founder labels.

## Wording that ships (interim, pre-M4-04)

Cover boundary block: "Homeschooling is legal in all 50 states,
including {State}. This pack organizes {State}'s published homeschool
rules so you can see them in one place. It is legal information, not
legal advice, and Homa is not a law firm. Downloading or filling out
this pack does not notify {State} and does not by itself satisfy any
state requirement of any kind; the record templates become part of your
own records once you fill them in, and where a filing is required, this
pack links to the official channel. Different pathways in {State} can
carry different rules; this pack covers the {default pathway} pathway,
the one most families use. Every rule here comes from the sources cited
in this pack, last verified {Month YYYY}. Laws change, so the current
statute is always worth a look before you act on a deadline. Make a
fresh pack from Homa before each school year and before filing
anything. If your situation is unusual, or a district ever questions
your homeschooling, a homeschool-friendly attorney or a legal defense
organization can advise you; this pack cannot."

Cover attribution block: "State requirement data by HomeschoolLeap
({page_url}), used under CC BY-SA 4.0
(creativecommons.org/licenses/by-sa/4.0). Homa reformatted and
summarized this data for your pack, and the requirement summary
sections are available under that same license. The data is provided as
is by its source. Your family's information and the Homa name and logo
are not part of that license."

Prep sheet boxed header: "This worksheet helps you gather what {State}
asks for in a notice of intent. It is not the official form and cannot
be filed. When it is filled in, copy the details into the official form
here: {official URL}. Homa does not file it for you."

## Known limits, tracked as issues

- Typed payload under-represents NY (quarterly reports) and PA
  (notarization, evaluator certification, grade-scoped testing); the
  pack mitigates with scoped claims and official-source callouts, and
  the upstream gap is a P1 chore.
- Binder regeneration hint when the state row's `last_verified`
  postdates the pack (P2).
- Evidence report, marketing sample pack, ESA section, NOI letters,
  zero-duty optional templates, additional entry points: separate
  issues, three of them founder-gated.

## Council provenance

Full transcripts: workflow runs wf_2fd8495c-b27 (six-agent subsystem
map) and wf_2ac15d8a-f8d (five experts + adjudicator), 2026-07-28
session. Data freshness: `pnpm pull:state-requirements` run 2026-07-28
returned zero content drift against the reviewed 2026-07-07 snapshot
(manifest timestamp only), so the prod table matches the reviewed data
and no reseed was needed.
