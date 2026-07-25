# Materials generation: the 48-hour field review and the iteration system it demands

Date: 2026-07-24. Status: AWAITING FOUNDER RULINGS (§6). Evidence: direct
read-only production Supabase queries run 2026-07-24 (project
kzplntcdtsvdowntvlza) covering 2026-07-22 to 2026-07-24, full conversation
forensics on the one family that used materials in the window, code-mechanism
tracing in this worktree, a six-seat expert council with three adversarial
fact-check passes (subagent transcripts in the session workflow directory),
and the finding-unknowns discipline: every claim below is labeled Verified,
Inference, or Question.

**Short answer: in the last 48 hours the materials product had exactly one
real customer, and it failed her.** A mother of three asked for a week of
worksheets at 4:25pm and was still typing page-by-page corrections past
midnight: 71 drafts, 31 revisions of one packet, 51% of drafts flagged by our
own quality checker, seven repetitions of the same "blank space at the
bottom" complaint, roughly $100 of compute, and zero approved materials. Her
Binder is empty. Meanwhile 32 other families chatted with Homa and not one
asked for a material. Every failure she hit has a specific, cited mechanism
in this codebase, and most of them are cheap to fix. The deeper deliverable
of this document is not the bug list: it is the measurement and iteration
system (§5) that makes materials quality a number we ratchet instead of a
vibe we debug at midnight.

## 0. Ground truth (verified against production, not estimated)

| Fact | Number | Source |
|---|---|---|
| Claimed real (non-sandbox) families | 50 | `families` where `sandbox=false and status='claimed'` |
| Families that sent any user message in the 48h window | 33 | `conversation_messages` join `families` |
| Families that created any material in the window | **1** | `materials` join `families` |
| Materials created by that family (304f0003) in the window | 71 (+5 sandbox fleet-wide) | `materials`, 48h window |
| Drafts finalized in the window | **0** (prior 7 days: 53 finals fleet-wide) | `materials.status`, `mark_material_final` tool calls |
| Drafts flagged by the vision QC | 36 of 71 (51%) | `materials.generation->'review'->>'pass'` |
| Longest revision chain (one packet, one evening) | 31 revisions, no final | recursive walk on `materials.revises` |
| `create_printable` calls | 85 = 71 created + 11 generic HTML-gate rejections + 3 page-cap rejections | `agent_tool_calls` results |
| `mark_material_final` calls in window | 0 | `agent_tool_calls` |
| Image generations before the family's daily budget ran out | 30 (cap) in the first ~55 minutes; then 6+ refusals that evening | `agent_tool_calls` tool='generate_image' |
| Revision turn time (her message to the new card) | 6 to 17 minutes each | `conversation_messages` timestamps |
| Model spend on the evening (2026-07-23 20:00Z to 07-24 05:30Z) | 227 sonnet calls, 26.0M input + 17.6M cache-read tokens, 1.49M output tokens, 71 QC calls, 46 images (~$100, order of magnitude, Inference) | `model_usage` |
| Organic material requests from the other 32 chatting families | 0 (keyword sweep; every hit was an automated morning-brief dispatch) | `conversation_messages` |
| Prior 14 days: materials activity shape | Single-family bursts: 61/day (a64e1ba5), 50/day (d439f7d7), 37/day (c18d5def); most families most days: zero | `materials` by family by day |

Windowing note (adversarial fact-check): the "48 hours" is a rolling window
from query time; the evening under study sits fully inside it. The 31-deep
chain was verified by hand-walking `revises` links, not just the recursive
query. The zero-organic-requests sweep is keyword-based and can miss
demand phrased without material words; treat the "0" as "no detected
requests" (Verified as bounded claim).

## 1. The evening, as she lived it (2026-07-23, times US Eastern)

All quotes verbatim from `conversation_messages` for family 304f0003
(three girls, ages 9, 6, and 3; signed up 2026-07-07).

- **16:25** "…make me a week's worth of worksheets reviewing space for a
  second grader… I would love watercolors. I want word searches. I want
  matching. I want vocab. I want facts." Three packets (one per child) exist
  by 16:35. The build itself is fast: 10 to 30 seconds per call.
- **17:13** "These are very surface level. I need more information… I need
  the pages to be filled with activities appropriate for each age."
- **17:16** "Homa I am waiting" · **17:20** "Eta?" · **17:28** "Where is it?"
- **17:17** She invents her own process to cope: "Start with Amalia. Once
  approved we can move on to Ara and Alma."
- **17:19** The agent burns the last of the 30-images-per-day budget (23
  calls in two minutes, three packets in parallel). The tool starts
  answering "This family's image budget for today is used up." Homa tells
  her "my image generator for illustrated art is tapped out for today" and
  pivots to web stock photos; the QC later flags a visibly watermarked
  stock butterfly.
- **17:31** "They have lots of room at the bottom still" · the first of
  **seven** blank-bottom complaints (17:31, 18:36, 19:06, 19:15, 21:57,
  22:07, 23:55).
- **19:23** Homa overrides its own checker to her: "The last two issues the
  checker raised were minor and inconclusive… so I'd love your eyes on it
  directly."
- Homa opens reply after reply with internal jargon: "It passed the quality
  check." "It passed this time." "Fixed and it passed."
- **21:57** "Email worksheet" → "I don't have a way to attach it inside an
  email." (True: no tool can email a material.) That morning, 12:49: "Where
  are the emails you said you would send me from our call earlier today?"
  (a promise made on the phone line; zero `email_sends` rows exist for this
  family in the window).
- **22:23** "Where are the updates" · revision turns are running 6 to 17
  minutes and she is no longer watching the tab; nothing notifies her when
  a version lands.
- **00:40 to 00:43** Past midnight, phone typos showing: "No way a 3 [year]
  old van cut those tiny rectangle at the bottom of page either." Three
  more revisions arrive by 01:08. She never approves. Next morning she
  leaves for a trip and uses Homa as a travel concierge instead.

She was still here the next day: this was not churn, it was a customer
doing our QA for free, for eight hours, and getting nothing durable for it.
Her Binder (finals only) contains nothing from the entire evening.

## 2. Failure inventory (mechanism-cited)

Each failure names its mechanism with file:line, its user-facing symptom,
and its evidence label. Council fact-checkers re-traced every citation;
corrections from that pass are folded in.

### F1 · The blank-bottom / cut-off oscillation (Verified; the core defect)
Pages are exact 11-inch boxes with `overflow: hidden`
([page-shell.ts:205-224](../../../apps/web/lib/materials/page-shell.ts)).
Nothing in the loop measures rendered content height, and the skill
prescribes no technique for hitting the height
([SKILL.md:267-281](../../../apps/web/agent/skills/materials-studio/SKILL.md)).
So the model composes blind against a hard box: undershoot leaves the blank
bottoms she named seven times; overshoot silently clips ("cut off at the
bottom", her other recurring complaint). These are the two failure modes of
one mechanism, and 31 revisions oscillated between them because every fix
was a blind re-guess. **This is the single highest-leverage defect in the
materials product.**

### F2 · The tool tells the model a QC-failed card is visible when it is not (Verified, sharpened by the fact-check in §2.5)
On web, a QC-failed draft is still inserted, and the tool result tells the
model, in one string: "The card…is already visible in chat. Tell her it's
ready in one warm sentence…invite tweaks. Quality check found issues: […]"
([create_printable.ts:775-805](../../../apps/web/agent/tools/create_printable.ts)).
But the web client filters `reviewPassed === false` cards on the live path
too, so no card renders. The agent, following its instructions, announced
readiness 36 times for cards that did not exist, and sometimes argued with
the checker out loud (19:23). On SMS the same failure honestly withholds
the send until a version passes (create_printable.ts:710-745); web needs
the same revise-first note.

### F3 · QC and previews stop before her problem pages (Verified)
The vision QC reviews only the first 4 pages (`REVIEW_PAGE_CAP = 4`,
[review-artifact.ts:29](../../../apps/web/lib/materials/review-artifact.ts));
previews cap at 6 (`PREVIEW_PAGE_CAP = 6`,
[render-page.ts:50](../../../apps/web/lib/materials/render-page.ts)). Her
packets ran 7 to 11 pages and her complaints centered on pages 3, 6, and 7:
page 6+ was structurally unreviewable by QC, and pages 7+ invisible on the
card without opening the PDF
([material-card.tsx:112-118](../../../apps/web/app/app/material-card.tsx)).

### F4 · The HTML gate rejects without saying why (Verified)
One generic message covers three different rules (blocked markup; em dash;
banned deficit words), never names the rule that fired or where, and also
scans metadata fields (title, skill, subject, requestSummary) that the
message never mentions
([page-shell.ts:96-102](../../../apps/web/lib/materials/page-shell.ts),
create_printable.ts:450-462). Production shows 11 consecutive rejections in
one session: a model cannot fix what the error will not name. This violates
the spirit of our own tool-honesty law.

### F5 · The image budget dies silently mid-conversation (Verified)
30 images/family/day ([generate_image.ts:30](../../../apps/web/agent/tools/generate_image.ts));
no warning approaches the cliff, nothing reserves budget for the revision
phase, and the fallback path (SerpAPI Google Images via `search_photos`) has
no watermark or licensing filter, while the QC prompt has no watermark rule
(serp-images.ts; review-artifact.ts:54-69). Net effect on 07-23: quality
degraded mid-session in a way the parent could see (watermarked stock
photo) and the agent could only apologize for.

### F6 · Every revision regenerates the whole packet (Verified)
The skill's revision rule is "change only what she named, keep everything
she liked, same image URL" (SKILL.md:537-539), but the model must re-emit
every page's HTML each time; `fromMaterialId` page reuse exists in the tool
yet the skill teaches it only for combining volumes (SKILL.md:321,331).
Consequences, all observed: 6-to-17-minute revision turns (1.49M output
tokens in one evening), regressions on untouched pages (page 2 became newly
cut off at 23:41 after being fine for hours), and full re-render + re-QC
cost per iteration.

### F7 · The transcript does not mirror what she lived (Verified mechanisms, corrected in §2.5)
Three layers, all verified: (a) QC-failed drafts never render a card at
all, live or archived, while the agent is told to announce them (the F2
sharpening); (b) on session archive, N passing revision cards collapse to
one, the newest passing revision, anchored wherever its timestamp falls
([parent-visible.ts:40-72](../../../apps/web/lib/materials/parent-visible.ts),
[chat-history.ts:159-188](../../../apps/web/lib/chat-history.ts),
chat-history-model.ts:254-297); (c) `MATERIAL_CAP = 80` is applied
family-wide before session filtering, so the 20 anomaly-session artifacts
(see F13) plus her 71 (91 > 80) could have pushed her oldest real cards out
of scrollback before cleanup (now resolved, see F13). Which of her
"Where is it?" moments trace to (a) versus plain latency is settled by
T11; (a) needs no further proof to justify P0.1.

### F8 · Approval is a phrase she never says, so nothing survives (Verified)
Only `mark_material_final` (agent-invoked on an explicit approval phrase)
makes a material durable; the skill rightly forbids nagging (SKILL.md:540-542);
the Binder lists finals only
([binder/page.tsx:45-48](../../../apps/web/app/app/binder/page.tsx)). There
is no approve affordance on the card, no next-morning "want me to lock in
last night's version?", and no in-progress section in the Binder. Result:
8.5 hours of work produced zero durable artifacts in her product surface.

### F9 · "Email worksheet" cannot be honored, and we cannot see that it wasn't (Verified)
`send_followup_email` is text-only (no attachment or material parameter,
[send_followup_email.ts:30-37](../../../apps/web/agent/tools/send_followup_email.ts));
no tool emails a PDF. Separately, agent-composed emails skip the
`email_sends` ledger entirely (the agent path never sets `args.ledger`,
[email.ts:206-213](../../../apps/web/lib/map/email.ts)), so the founder
console is blind to whether promised emails happen. She asked for email
delivery twice on two surfaces in one day.

### F10 · Long turns have no completion signal (Verified)
The web composer shows escalating status labels during a turn
([message-parts.tsx:942-975](../../../apps/web/app/app/message-parts.tsx)),
which is good and post-dates earlier latency incidents, but a 6-to-17-minute
revision with the tab backgrounded ends in silence: no SMS nudge, no push,
despite SMS being live for this family (her morning briefs arrive there).
The skill even tells her "You don't have to wait here" (SKILL.md:551-564)
with no mechanism behind the promise.

### F11 · The flagship capability is dormant across the fleet (Verified, bounded)
1 of 33 active families created materials in the window; the keyword sweep
found zero organic material requests from the rest. The last two weeks show
the same single-family-burst shape. Whether this is awareness, summer, need,
or trust cannot be answered from this data (Question); §5 includes the
cheap demand test that answers it.

### F12 · Voice degrades under load (Verified)
"It passed the quality check" as a reply opener, eight-plus times, is
machinery-speak to a tired mother and violates the copy laws (clarity,
reassure-before-inform). Small, but it shaped the whole evening's texture.

### F13 · The Diag-storm anomaly (RESOLVED and CLEANED UP 2026-07-24)
A session with zero conversation messages (`wrun_01KY8DF4M4GB29PD5W4GS84FNS`)
ran 31 `create_printable` calls at 17:24-17:42 ET on 2026-07-23 inside this
real family's tenant, creating 20 rows total: 16 standalone test materials
("Minimal Test Two…Seven", "Diag Day1-5", "Diag Creature C/E") plus 11
generic gate rejections, AND, more seriously, 4 rows that forked and
revised her own real "Alma's Biomes & Ecosystems Week" draft over an hour
after she had last touched it, renaming it "A Mini Unit Study" without her
asking. Because the newest of those four (created 21:42 UTC) passed
quality review, it was the version scrollback would have shown her on
reload, silently replacing her real last-known-good draft (created 20:35
UTC, also QC-passing).

**The founder confirmed it was not them.** Traced the same day:
`vercel logs --since/--until` plus a full dashboard export of every request
to the production app for the entire incident window (2026-07-23 21:15 to
21:40 UTC, 66 requests total) show precisely three sources and nothing
else: the mother's own Android Chrome phone (31 requests, matching her six
real chat sessions from her transcript exactly), Telnyx's inbound SMS
webhook (23), and Vercel's own cron ping (12). The target session id
appears in zero of these requests, and no fourth user agent (no script, no
curl, no headless browser) exists anywhere in the window. **This means the
20 rows were not created by any request to the live website at all**; they
were written directly to the production database and Blob storage by
something running outside Vercel's request pipeline: almost certainly a
local development session (a coding agent or a developer running the tool
code directly, e.g. `pnpm dev` or a standalone script) that had production
credentials and, working from her live 17:13 "very surface level"
complaint, used her real family record as the test target instead of a
`+homatest` sandbox family. A repo-wide search (git log across all local
history, all scripts, all docs) found no committed fixture or script
producing these exact titles, consistent with an uncommitted, throwaway
local script. The remaining gap: which specific local session did this
cannot be identified from this repo or from Vercel; it would require
checking whoever had `.env.local` prod credentials and was active that
evening.

**Cleanup already applied (2026-07-24):** all 20 rows were marked
`status = 'superseded'` (tightly scoped by `family_id` and the anomaly
`sessionId`, verified by `returning` and a follow-up count query). This
removes them from her Binder, her chat scrollback, and her agent's
"unfinalized" hint, and it restores her real 20:35 UTC draft as the
version scrollback resolves to, since the selector already treats
`superseded` rows as retired. No data was deleted; the change is a status
flip and fully reversible. Remaining action: treat this as the concrete
case for a rule this session itself is a live example of needing: local
or dev sessions with production credentials must target a `+homatest`
family, never a real one, even for a quick reproduction. Consider a
lightweight guard: reject writes from non-Vercel-originated requests, or
from any local script, to a non-sandbox family's materials path without an
explicit override flag.

## 2.5 Corrections the adversarial verifiers forced (read before §2)

Three fact-check subagents re-traced every citation. Most findings held.
Three did not survive unchanged, and one refutation rewrites the story:

- **F2/F7 REFUTED IN PART, and the truth is worse.** The web client never
  renders a card for a QC-failed draft, live or on reload: the live path
  filters `reviewPassed === false` too
  ([material-message-parts.ts:74,100](../../../apps/web/app/app/material-message-parts.ts),
  [parent-visible.ts:61-65](../../../apps/web/lib/materials/parent-visible.ts),
  shipped 2026-07-18, tested behavior). But the tool result unconditionally
  tells the model "The card…is already visible in chat. Tell her it's ready"
  (create_printable.ts:775). **So for 36 of her drafts, Homa pointed the
  mother at a card that did not exist.** "Where is it?" has a direct
  mechanism: the agent said ready; the screen showed nothing (only the
  "fixing a detail…" busy line). The fix is not scrollback persistence; it
  is the tool's delivery note lying about web visibility on QC fail.
- **Vanishing on reload is real but different:** each passing revision's
  card streams live in its own turn, and once the session archives, the
  whole chain collapses to one card (N cards become 1), specifically the
  newest QC-passing revision, anchored possibly mid-transcript. Her chain's
  final 01:07 revision passed, so today she sees that one. A chain whose
  every draft failed leaves zero cards. And `MATERIAL_CAP = 80` is applied
  family-wide before session filtering, so the 20 anomaly-session rows (see
  F13, now cleaned up) plus her 71 (91 > 80) could have pushed her oldest
  real cards out of scrollback entirely.
- **The anomaly contaminated the headline stats.** Recounted excluding the
  Diag session: her organic evening was 51 materials, 28 QC-failed (55%),
  48 of 51 were revisions. The 11 validator rejections all happened inside
  the anomaly session, not to her. Numbers in §0 stand as fleet facts; her
  personal numbers are these.
- **The broken email promises are now verified on the correct table:** the
  agent path writes `chat.email_sent` events, not `email_sends`. Zero
  `chat.email_sent` events exist on 07-23 (both promises broken); exactly
  one exists on 07-24 10:40 (her NYC schedule summary), and it wrote no
  `email_sends` row, which is the observability hole demonstrated live.
- **The image cap is already broken in production, not merely abrupt:** the
  limiter is an in-memory per-instance Map
  ([ratelimit.ts:8-33](../../../apps/web/lib/map/ratelimit.ts)) that resets
  on deploy and diverges across instances. Prod shows two families
  exceeding it: 304f0003 had 37 generated images on 07-23 (61 calls) and
  c18d5def had 31 on 07-20. The same substrate backs the email, SerpAPI,
  and SMS-progress caps. Every cap the product believes it has is soft in
  both directions.
- **The success baseline nobody had:** of 55 chains reaching `final` in the
  prior 14 days, 34 finalized with zero revisions, 12 with 1 to 3, and only
  5 needed 7 or more. First drafts mostly work; the revision loop is where
  value dies. 58 finalize calls across 5 families in 9 days also shows
  batch approval behavior ("keep them all") that a per-card phrase flow
  handles awkwardly.

## 3. Council verdict

Six sealed seats reviewed the brief independently (they could read this
repo but not each other), then the chair synthesized. Roster: **Priya
Raman** (print/layout engineering), **Marcus Bell** (LLM agent systems and
evals), **Jess Whitfield** (homeschool mother of four, audience voice),
**Sofia Andrade** (product analytics/growth), **Tom Okafor** (ops/SRE),
**Rae Calloway** (red team). These are simulated perspectives, a lens and
not a verdict; full takes are in the companion file
(`2026-07-24-materials-council-takes.md`).

**Chaired verdict.** The council unanimously rejects "ship the eight
directions" in favor of a narrower sequence: fix the four live lying-string
and ledger bugs now; build the fixture set and deterministic measurement
before any behavioral change; make revisions surgical and stateful; and
treat templates, QC authority, and activation as decisions to be settled by
named cheap experiments, not by this document. The evening was not one
failure but three compounding loops: the model composes blind into a box
whose true size it is never told; the checker's verdict is delivered inside
a false instruction (the card it references does not exist on web); and
each revision regenerates everything, forgetting her standing rules and
regressing untouched pages. Break any one loop and the evening shortens;
break all three and it becomes twenty minutes.

### Where the council agrees (high-reliability signal)

1. **Fixtures and measurement precede everything.** Five of six seats gave
   the same first action: export the 31-revision chain (stored HTML, QC
   verdicts, her verbatim timestamped critiques) plus the burst families'
   materials as an offline fixture set, and add deterministic per-page
   fill/clip measurement to the render path, offline first. The metric is
   pixels and DOM numbers, never a model's opinion (Priya: "ratchet the
   deterministic number, the way memory-compaction-eval does").
2. **The strings are lying and are same-week fixes:** the web QC-fail note
   (says a nonexistent card is visible), the validator note (names no rule,
   no token, hides that it scans metadata fields; SKILL.md:281 promises
   "tells you why", which is false), QC coverage nondisclosure ("Quality
   check passed" on a 9-pager it saw 4, later only 6, pages of), and the
   canvas misstatement (schema says 8.5x11in; the real content box is
   7.3x9.5in, roughly 14% phantom vertical space that biases toward clip).
3. **Surgical revision requires a small tool change, not skill prose:**
   `fromMaterialId` contributes all pages of a material; "keep pages 1-2
   and 4-7, replace page 3" is structurally inexpressible today. Add a
   page selector, teach revise-by-splice, and hash unchanged pages to skip
   re-QC (verdicts cannot flap on identical bytes) and prove zero
   regression by construction.
4. **A standing-constraints ledger per revision chain**, built
   model-proposes-code-verifies (verbatim quote re-checked against her
   message), injected into both the compose context and the QC brief. She
   said "fill the pages" seven times; a system with a ledger hears it once.
5. **No autofix loop inside create_printable and no slot templates yet.**
   The tool runs at 105s observed p99 against a 210s deadline; in-tool
   re-render loops eat that headroom on exactly the worst packets (Tom).
   Slot templates collide with the recorded no-template founder ruling
   written into create_printable.ts:71-73 and must be relitigated with
   data, not built silently (Priya). Measurement-with-recompose-by-model
   first; escalate only if the convergence replay says numbers alone do
   not converge.
6. **Instrument consumption before optimizing ceremony:** a
   `materials.pdf_opened` beacon (redirect route, ~20 lines) is the missing
   terminal event. Until it exists, finalize-rate is a proxy and "her
   Binder holds nothing" cannot distinguish lost value from skipped ritual.
7. **Do not push activation into this pipeline yet.** Offering materials to
   32 warm families before the revision loop is fixed replicates her
   evening at fleet scale and burns single first impressions (Jess, Tom,
   Rae). Instrument the funnel now; run the demand probe after P0/P1 land.

### Where the council splits, and the chair's read

- **Templates vs measured freeform** (Jess vs Priya/Marcus/Tom/Rae). Jess:
  "every curriculum I buy is templated; I do not want creative page layout,
  I want a word search that fits." The rest: templates flatten the
  open-ended range that produced the request, and the no-template ruling
  stands until relitigated. Chair's read: run the convergence replay (T3);
  if measured freeform converges in 1-2 iterations, templates stay dead; if
  it oscillates, bring Priya's slot-template trial to the founder with the
  replay data. The experiment is cheap and settles it.
- **QC authority on web** (Jess: never show flagged work; Marcus/Rae: never
  gate on an uncalibrated checker; Tom: founder call). Dissolved by the
  verifier refutation: web already withholds flagged cards; what remains is
  making the tool note honest about it (revise-first, like SMS) and
  calibrating QC (T2) before granting it any further authority. The 51%
  fail rate is uninterpretable until precision/recall against her real
  complaints is measured; the agent's 19:23 "minor and inconclusive"
  override is evidence about QC precision, not just agent misbehavior.
- **What failed first: geometry or content** (Jess/Rae vs the brief). Her
  first complaint (17:13) was "very surface level", content depth, before
  any blank bottom, and her last (00:43) was a fine-motor age-fit failure.
  A fill% metric alone Goodharts into padded, content-light pages. Chair's
  read: accepted in full. Every layout gate ships paired with an
  activity-count/density measure, and the QC prompt gains per-child age
  and physical-task criteria (scissors skills at 3, tracing size). This
  was the review's largest blind spot.
- **How bad is fleet dormancy** (brief vs Sofia/Marcus/Rae). A 48h midweek
  window over a weekly-cadence behavior, measured with a keyword sweep
  that violates the house models-judge law, cannot establish dormancy; the
  prior week shows 5 families finalizing 58 materials. Chair's read:
  conceded. F11 is downgraded to "bursty, power-user concentrated, unknown
  discovery gap"; the model-judged organic-request scan (T8) and a
  proper 14-day funnel replace the claim.

### The objection the founder must answer

Jess Whitfield: *"Her FIRST complaint at 17:13 was 'these are very surface
level. I need more information,' and her LAST complaint at 00:43 was that a
3-year-old cannot cut tiny rectangles. Content depth and age-fit, the
actual product, never appear as a finding or a direction… No amount of
layout determinism buys approval of thin work, so any fill metric must be
paired with an activity-density and age-fit check or D1 makes the packets
worse while the dashboard turns green."*

## 4. The work, sequenced

Phases are PR-sized and flag-gated where they touch behavior. Nothing in
P1+ ships without its eval (§5). P0 items are live production bugs under
the fixed-not-stored ruling and are escalated as such.

### P0 · This week: stop the lying, close the ledgers (no founder ruling needed)

| # | Fix | Where | Why now |
|---|---|---|---|
| P0.1 | Web QC-fail branch of the delivery note: replace "card is already visible…tell her it's ready" with the revise-first instruction the SMS branch already has, plus an honest one-liner she can hear ("one page needs a fix first") | create_printable.ts:775 | The note currently instructs the model to point her at a card the client never renders; 36 times that evening |
| P0.2 | Validator names the fired rule, the offending token, and the field (including metadata fields); make SKILL.md:281's "tells you why" true | page-shell.ts:96-102, create_printable.ts:450-462 | 11-rejection loops are unfixable feedback; skill lies about the tool |
| P0.3 | Disclose QC coverage in the note ("checker reviewed pages 1-4 of 9") | create_printable.ts:776-781 | Agent honestly overclaims "it passed" fleet-wide |
| P0.4 | Tell the model the true canvas: content box 7.3in x 9.5in (700x912 CSS px) in the schema text and SKILL.md | create_printable.ts:169, SKILL.md:268-270 | ~14% phantom vertical space biases every page toward clip |
| P0.5 | Agent emails always write the `email_sends` ledger | email.ts:206-213, 451-466 | Proven blind spot: the 07-24 10:40 send left no row |
| P0.6 | Watermark/licensing filter on `search_photos` results + a watermark rule in the QC prompt | serp-images.ts, review-artifact.ts:54-69 | A watermarked stock photo nearly reached a child's printer |
| P0.7 | `materials.pdf_opened` beacon: redirect route emitting a map event; point the card's PDF/print links at it | material-card.tsx:77,126 + new route | The funnel has no terminal event; every metric is a proxy |
| P0.8 | Durable image budget: Postgres/day-bucketed count (the in-memory cap is proven broken in prod), stop charging failed generations, append "images used today: N of 30" to every result, warn at 24, add a per-turn cap | generate_image.ts:130-137, ratelimit.ts | Cap already exceeded twice in 14 days; exhaustion mid-chain degraded her packets |
| P0.9 | DONE 2026-07-24: F13 cleanup. Origin resolved (local/dev session with prod credentials, not the founder, not any live-site request, 4 of the 20 rows had forked her real draft). All 20 rows marked `superseded`, tightly scoped by family + session id, verified; her real draft is now correctly the visible version again. Remaining: add a rule that local/dev sessions with prod credentials must target `+homatest` families only | materials | Confirmed data pollution in a real family's tenant, now contained |

### P1 · Next: measurement, fixtures, evals (gates everything after it)

- **Fixture export**: her 31-revision chain + burst families (a64e1ba5,
  d439f7d7, c18d5def) with HTML, QC verdicts, and her labeled critiques.
- **Deterministic per-page measurement** in `renderPrintableHtml` (one
  `page.evaluate`: content height vs the 912px box → `{fillPct, clippedPx}`
  per page), returned in the tool result, persisted in `generation`,
  appended to the QC brief as stated facts. Offline backtest first (T1):
  the thresholds come from her complaints, not from taste. Explicitly
  measure-and-report, no in-tool autofix loop (deadline headroom, T6 gate).
- **Uncap the raster to true page count** (PREVIEW_PAGE_CAP is upstream of
  QC coverage); QC reviews all pages or samples deliberately (first, last,
  changed); card previews stay capped at 6 as a pure UI concern.
- **Pair fill with density**: activity-count per page measurement, and
  per-child age/motor-skill criteria added to the QC prompt (Jess's
  objection made checkable).
- **The eval harness set** (§5) lands here and starts ratcheting in CI.

### P2 · Then: make revision cheap, stateful, and bounded

- **Per-page splice**: `pageNumber` on `fromMaterialId` pages entries;
  skill teaches revise-by-splice (re-emit only named pages); hash-dedupe
  unchanged pages, skipping re-QC. Expected: revision turns drop from
  6-17 min toward one-page cost; untouched-page regressions become
  impossible by construction. Gated on the revision-replay eval (T3).
- **Standing-constraints ledger** per chain: model extracts constraint +
  verbatim quote, code verifies the quote, ledger rides every compose and
  QC brief. Needs founder ruling FD-3 (preference may override the
  skill's whitespace law).
- **Circuit breaker + alerts**: chain length / consecutive-QC-fail
  thresholds flip the tool note to stop-and-offer; founder-console alerts
  on chain length, QC-fail streaks, budget anomalies, and artifact
  creation by messageless sessions in non-sandbox tenants.
- **Sample-first ritual** in the skill: multi-child or >4-page requests
  build one proof page per child, one approval question, then the batch
  planned against remaining image budget (her own invented workflow,
  productized). A/B via T5.
- **SMS completion nudge** for long web turns with an active pending
  revision only: consented phone, quiet hours, durable dedupe, flag off by
  default (FD-6).

### P3 · Approval, delivery, and demand (founder-gated)

- Approve affordance on the card and/or agent states the approval
  mechanism once per chain (FD-2); next-morning stranded-chain follow-up,
  one quiet message (FD-2); Binder gains an in-progress section.
- Link-carrying material email (the Resend path has no attachment support
  at all today; a link satisfies the job), always ledgered (FD-7).
- Zero-wait demand probe on warm families with controls, one send, only
  after P1/P2 (FD-8), and the model-judged organic-request scan (T8)
  replaces the keyword sweep.

### Explicitly deferred, with triggers

Slot templates (trigger: T3 shows non-convergence; needs FD-4), full
12-page vision QC on every call (trigger: T2 shows the cap loses real
signal and sampling misses it), email attachments (trigger: link emails
measurably unsatisfying), morning-brief activation at scale (trigger:
P0-P2 shipped and the health dashboard is green two consecutive weeks).

## 5. The measurement and iteration system (the durable deliverable)

The point is to make "families get usable materials quicker, more
reliably, with less feedback" a set of ratcheted numbers reviewed weekly.

### 5.1 Definitions (funnel and quality)

- **Request**: a new revision-chain root (plus, later, a
  `materials.requested` event at skill load). **Draft**: chain root
  created. **Iteration**: revision row. **Delivered**: card rendered
  (passing) or SMS sent. **Consumed**: `materials.pdf_opened`. **Kept**:
  `final`. Terminal states: consumed-and-kept, consumed-unkept, abandoned
  (>48h idle, no open), stranded (idle, opened, no final).
- **Quality numbers**: first-draft usability (chain length 0 at final or
  consumed), median revisions per consumed chain, per-page fillPct band
  hit rate, clippedPx=0 rate, QC precision/recall vs parent complaints,
  revision turn p50/p95 wall time, and per-family-day compute.
- Sandbox families and non-parent sessions are excluded by construction;
  materials rows gain an origin tag (chat / agent-job / lesson / diag) so
  no future forensic has to reverse-engineer provenance.

### 5.2 The eval harness set (all fixtures from production, all ratcheted)

| Eval | Fixtures | Metric (deterministic) | Gates |
|---|---|---|---|
| Layout fill/clip | Her 31-chain + burst families' HTML re-rendered locally | fillPct in band, clippedPx = 0, activity count not decreased | P1 measurement, any layout change, FD-4 relitigation |
| Revision convergence replay | (prior HTML, her verbatim critique) pairs | iterations-to-satisfied, untouched pages byte-identical (splice) or fill-stable (regen), constraints still met | P2 splice + ledger; the templates decision |
| QC calibration | Stored preview JPEGs + her labeled complaints (+30-material human-labeled sample) | precision/recall per issue class; share of true complaints on pages QC never saw | Any change to QC authority, coverage, or criteria (FD-1) |
| Constraint adherence | Chains with repeated parent rules | % of standing constraints satisfied per revision | P2 ledger |
| Validator convergence | The 11 rejected payloads (reconstructed) | attempts-to-pass, generic vs named-rule note | P0.2 (confirms the fix mattered) |
| Deadline headroom | 12-page worst-case packets, 20 runs | p99 tool time < 50% of the 210s ceiling | Any in-tool render/measure work |

### 5.3 The experiments (cheapest-first, each settles a named fork)

| # | Test | Settles |
|---|---|---|
| T1 | Measurement backfill: re-render all 219 stored materials, correlate fillPct/clippedPx with her 7 complaints and the 36 QC fails | Whether the metric reproduces her judgment; the band thresholds; F1 quantitatively |
| T2 | QC calibration run (above) | Gate vs advisory (FD-1); page-cap vs criteria as the recall limiter |
| T3 | Convergence replay: skill vs skill+numbers vs skill+numbers+ledger | Measured freeform vs slot templates (FD-4); D3 vs D1 priority |
| T4 | Splice benchmark: 5 real revisions both ways; tokens, wall time, byte-identity | F6's payoff size before the schema change ships |
| T5 | Sample-first A/B on next organic multi-child requests (sandbox-verified first) | Whether proof-then-batch beats fast-first-draft on time-to-approved and typing |
| T6 | QC flap: same bytes 3x; full-coverage cost on gpt-5.4-mini | Hash-dedupe justification; the REVIEW_PAGE_CAP economy argument |
| T7 | Offline slot-template trial scored by T1's measurer | Arms FD-4 with data if T3 oscillates |
| T8 | Model-judged organic-request scan over 14d transcripts (schema + verbatim-quote verification, per house law) | Whether "zero organic requests" was real or a lexical artifact |
| T9 | Stranded-chain morning follow-up, flag-gated, 2 weeks | Whether F8 is affordance or concept (informs FD-2) |
| T10 | Zero-wait sample demand probe, 15 warm + 15 control, one send | Discovery vs demand for the silent families (FD-8) |
| T11 | Reload-reconstruction of her transcript + Vercel log pull for the 07-24 17:12 "where are your responses" turn | Whether a turn-loss bug is churning users post-session |

### 5.4 The weekly loop

One scheduled weekly materials-health review (query + short note in the
build log): funnel counts, quality numbers, eval ratchet status, any
tripped alerts, one decision. Alerts page the founder console on: chain
length ≥ 8 with no final, ≥ 4 consecutive QC fails on one chain,
messageless-session artifacts in non-sandbox tenants, any family-day
image count over cap, and agent emails without ledger rows (should become
impossible after P0.5). The review's first three weeks double as the
before/after for P0-P2.

## 6. Founder decisions

- **FD-1 · QC authority on web.** Web already withholds flagged cards; the
  tool note must stop claiming otherwise (P0.1, no ruling needed). The
  ruling: once T2 reports precision/recall, does QC gain revise-first
  authority on web permanently, and at what precision threshold? The
  2026-07-10 "agent stays the decision-maker" direction needs restating or
  amending either way.
- **FD-2 · Approval.** (a) May the card carry a one-tap "Keep this one"
  affordance (offers-never-commands)? (b) May the agent state the approval
  mechanism once per chain without it counting as nagging? (c) Is one
  quiet next-morning follow-up on a stranded chain permitted? T9 can run
  on (c) alone if (a) is deferred.
- **FD-3 · Preference vs design law.** When a parent explicitly asks for
  dense pages, does her preference override the skill's "generous
  whitespace" rule, per family and persistent?
- **FD-4 · Templates.** Does the 2026-07-09/10 no-template ruling forbid
  internal measured slot templates as a composition aid? To be relitigated
  only with T3/T7 data.
- **FD-5 · Compute envelope.** Per-family-day spend ceiling (that evening
  was ~$100, 227 model calls) at which Homa stops and offers to finish
  tomorrow; and the per-turn image cap number.
- **FD-6 · Cross-channel nudges.** Consent posture and quiet hours for an
  SMS "it's ready" on long web turns with an active pending revision.
- **FD-7 · Material email.** Approve the link-carrying material email
  (always ledgered); attachments stay out until link emails prove
  insufficient.
- **FD-8 · Demand probe timing.** Approve the one-send zero-wait sample
  probe after P1/P2, given the brief-fatigue findings.
- **FD-9 · The Diag session (RESOLVED).** Confirmed not the founder;
  traced via Vercel logs to not be a live-site request at all (see F13) ~
  a local/dev session with prod credentials, run by someone unidentified,
  wrote directly to the database. No further founder decision needed
  except approving the cleanup (P0.9) and, going forward, the local/dev
  credential rule this session itself should have followed: `+homatest`
  sandbox targets only, even for a quick reproduction.

## 7. Open questions only the founder can answer (from the council)

Has she asked for a single material since that evening? Did any of the 5
finalizing families reach you directly with praise or complaints? What
were the 32 silent families told about materials at onboarding? Is
finalize load-bearing for celebrations/portfolio, or is a printed draft
just as good? Would she take a 15-minute call?

## Appendix

Full sealed expert takes and verifier reports:
`2026-07-24-materials-council-takes.md` (same directory). Raw query
outputs and the council brief live in the session scratchpad; the
workflow transcript is under the session's `subagents/workflows/`
directory (run `wf_b084d0f8-f29`).
