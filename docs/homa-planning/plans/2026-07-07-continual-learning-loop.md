# Continual Learning Loop: Foundation Design

> Status: PROPOSAL. Written 2026-07-07 after reviewing Replit's "Continual Learning
> for Agents" (Michele Catasta, @pirroh). Maps the three-layer improvement framework
> to homa's architecture, audits what exists, identifies gaps, and proposes concrete
> implementation sequenced against the existing backlog.

---

## 1. The framework, mapped to homa

Catasta's thesis: agents improve at three layers, and two of them are fully in your
control even with closed frontier models.

| Layer | What improves | Who benefits | Homa equivalent |
|---|---|---|---|
| **Model** | Weight updates, RLHF, new releases | Everyone (provider-wide) | Out of our control; we ride model upgrades via Gateway model-mix experiments (T2) |
| **Harness** | Code, tools, instructions, skills, prompts | ALL families (fleet-wide) | `instructions.md`, tool implementations, `skill_bank` rows, worksheet generators, scoring logic, benchmark data |
| **Context** | Per-user/org personalization from interaction data | EACH family | `family_memories`, `family_skills`, child `profile` (interests/focus), chat history, what-works teaching signal |

The compound effect for homa specifically:
- Every harness fix (better worksheet generator, sharper instruction, new bank skill)
  ships to all families on next deploy
- Every context enrichment (a family's saved memories, skills, profile updates) makes
  that family's experience sharper over time
- The flywheel: more families → more traces → more harness insights → better product
  for every family → more usage → more traces

---

## 2. Audit: what exists today

### 2.1 Context layer (per-family personalization)

| Component | Status | Where |
|---|---|---|
| **Family memories** (facts + what-works) | ✅ Built | `family_memories` table, `remember`/`forget` tools, `agent-memory.ts` (budget, scan, format), `family-context.ts` (per-turn injection) |
| **Family skills** (saved procedures) | ✅ Built | `family_skills` table, `save_skill`/`forget_skill` tools, `agent-skills.ts` (targeting, merge) |
| **Child profile** (interests, focus) | ✅ Built | `update_child_profile` tool, `children.profile` jsonb, injected per turn via `family-context.ts` |
| **Per-turn context loading** | ✅ Built | `defineDynamic` on `turn.started` loads family, children, memories fresh every turn |
| **Skill bank targeting** | ✅ Built | `skill-library.ts` merges family skills + bank skills filtered by child age/capability |
| **Post-turn learning review (M2-13)** | ❌ Not built | Planned: cheap-model extraction after each turn; schema-constrained profile writes |
| **Automatic context extraction** | ❌ Not built | Currently relies on the model calling `remember`/`update_child_profile` in-turn; no background extraction |
| **Recall past conversations (M2-15)** | ❌ Not built | Planned: FTS + pgvector over conversation history |

**Assessment:** The storage and injection layers are solid. The gap is *systematic
extraction*, right now the model must consciously decide to save something during the
conversation. M2-13 (post-turn review) is the planned mechanism to close this gap.

### 2.2 Harness layer (fleet-wide improvements)

| Component | Status | Where |
|---|---|---|
| **Agent instructions** | ✅ Built | `agent/instructions.md`, voice rules, memory protocol, skill protocol, worksheet spec |
| **Typed event registry** | ✅ Built | `packages/core/src/events.ts`, `chat.turn_completed` with status, latency, tool_calls, model_tier |
| **Skill bank** (founder-curated fleet skills) | ✅ Built | `skill_bank` table, published=true rows readable by all authenticated users |
| **Benchmark data** | ✅ Built | `docs/homa-benchmarks/`, 16 docs covering early childhood through K-10, norms, crosswalks |
| **Map scoring** | ✅ Built | `packages/core/src/map/`, deterministic benchmark scoring, band detection, content bank |
| **Worksheet generation** | ✅ Built (basic) | `create_worksheet` tool, text exercises; reportlab/fal pipeline still pending (M0-03) |
| **Production trace mining** | ❌ Not built | No mechanism to aggregate learnings across families' sessions |
| **Harness improvement pipeline** | ❌ Not built | No automated path from "pattern observed in N families" → instruction/tool/skill update |
| **A/B testing for instructions/skills** | ❌ Not built | Gateway model-mix experiments exist (T2) but not instruction/skill variants |
| **Fleet-wide quality metrics** | ❌ Not built | `chat.turn_completed` captures latency + tool counts, but not outcome quality |

**Assessment:** The harness itself is well-built. What's completely missing is the
*feedback loop*, there is no mechanism to learn from production usage across families
and feed improvements back into instructions, tools, or bank skills.

### 2.3 Model layer

| Component | Status |
|---|---|
| Model selection | ✅ `anthropic/claude-sonnet-5` via AI Gateway |
| Model-mix experiments | Planned (T2), Gateway supports per-family routing |
| Cost telemetry | Planned (FR-11), `ai-reporting-user` = familyId per call |

**Assessment:** Out of our direct control. The Gateway gives us the routing and
telemetry infrastructure to experiment, which is correct. No action needed beyond
the existing T2 plan.

---

## 3. Gap analysis: two missing loops

### Gap 1: Context-layer extraction (M2-13: already planned)

**What:** After each meaningful conversation turn, a cheap model reviews the
transcript and extracts durable learnings. This is Hermes's "background
self-improvement review" pattern, already spec'd in 06-harness-gap-analysis.md and
hardened by council S4.

**Why it matters:** Today, context enrichment depends entirely on the primary model
choosing to call `remember` or `update_child_profile` during the conversation. This
is unreliable, the model is focused on being helpful in the moment, not on extracting
durable learnings. A post-turn reviewer has the full conversation as evidence and a
single job: extract what's worth remembering.

**What's already spec'd (from existing docs):**
- Schema-constrained output (enumerated domains, bounded scores)
- Reduced toolset (only memory/profile tools; no schedule/billing/web)
- Delta/rate guards (>N subdomain moves get staged, not auto-applied)
- Writes recorded in `profile_revisions` with undo
- Injection defense per M2-14

### Gap 2: Harness-layer learning (NEW: not in current backlog)

**What:** A periodic job that mines conversation traces and event data *across all
families* to identify patterns worth codifying as fleet-wide improvements to
instructions, tools, or bank skills.

**Why it matters:** This is the moat mechanism. Individual families get better through
context learning. But the harness getting better, that's what makes family #50's
experience qualitatively different from what family #1 saw on day one. Without this
loop, harness improvements are manual and founder-driven only (Sidney notices
something in the admin console and rewrites an instruction). With it, the product
discovers its own improvement opportunities.

**This is the piece the Replit article calls out as the overlooked opportunity.**

---

## 4. Design: context-layer loop (M2-13 implementation)

This section refines the existing M2-13 spec with concrete implementation details
informed by the Hermes pattern (11-hermes-implementation-notes.md) and adapted to
eve's architecture.

### 4.1 Trigger mechanism

Eve's `turn.completed` event is the natural hook. The review fires after the
model's response has been delivered to the parent.

```
turn.started → model responds → response delivered → turn.completed
                                                         ↓
                                                   post-turn review job
                                                   (background, async)
```

**Fire conditions (all must be true):**
- Turn completed with `status: 'ok'`
- At least 2 user messages in the conversation (skip trivial "hi" turns)
- Family has auth context (familyId present)
- Not a review-spawned turn itself (no recursive reviews)

**Skip conditions:**
- Error turns
- Turns with 0 tool calls and <50 chars of model output (trivial)
- Rate limit: max 1 review per family per 10 minutes (debounce rapid exchanges)

### 4.2 Review execution

Follows the Hermes "same model = full replay for cache hits, aux model = digest"
pattern, adapted to eve:

**Option A (preferred for cohort one):** Use a cheaper model
(`anthropic/claude-haiku-3.5` or `gpt-4o-mini`) with a conversation digest. The
digest includes:
- Full family context block (same as what the primary model sees)
- Last 8 messages verbatim
- Earlier messages summarized (user: first 200 chars, assistant: tool names + first
  150 chars)

**Cost estimate:** ~$0.005-0.01 per review at current haiku pricing. At ~10 real
turns/day across cohort one, that's ~$0.05-0.10/day.

### 4.3 Review prompt (draft)

```
Review the conversation above with this family. Your ONLY job is to extract
durable learnings worth remembering. You have two tools:

1. remember(content, kind, childId?), save a fact or what-works entry
2. update_child_profile(childId, interests?, focus?), update a child's
   profile when their interests or focus genuinely changed

Extract ONLY:
- Family rhythms or preferences the parent revealed ("we do school in the
  morning", "Fridays are co-op")
- Per-child teaching signal: what worked, what didn't land, how they learn
  best ("Maya focuses better with visual activities", "timed exercises
  stress him out")
- Interest or focus changes ("she's obsessed with space now", "moved past
  counting, working on addition")
- Corrections to existing memories (forget the stale one, save the new one)

Do NOT extract:
- Task progress or one-off logistics ("printed the worksheet")
- Things the model already saved during the conversation (check current
  memories in the context block)
- Medical, diagnostic, or therapy-adjacent observations
- Anything shared in acute distress

If nothing worth saving, reply "Nothing to extract." and stop.

Schema constraint: each memory content must be ≤300 characters. Each
update_child_profile interests list must be ≤12 items.
```

### 4.4 Output constraints (council S4 compliance)

| Constraint | Implementation |
|---|---|
| Schema-constrained output | Review prompt limits extraction to enumerated tool calls with typed params |
| Reduced toolset | Review execution context only has `remember`, `forget`, `update_child_profile` |
| Delta/rate guards | If the review would move >2 profile fields or save >3 memories in one pass, stage the writes to `pending_profile_updates` for founder review |
| `profile_revisions` audit | Every profile write (from review or interactive) appends to `profile_revisions` with `source: 'review'` vs `source: 'interactive'` |
| Undo | Each review-sourced write gets a `review_batch_id`; undo reverts the whole batch |

### 4.5 Data model additions

```sql
-- Profile revision history (audit trail for M2-13 + interactive writes)
create table public.profile_revisions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete cascade,
  source text not null check (source in ('interactive', 'review', 'onboarding')),
  review_batch_id uuid,  -- groups writes from one review pass
  field_path text not null,  -- 'profile.interests', 'profile.focus'
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- Review run log (telemetry + rate limiting)
create table public.learning_reviews (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  session_id text,  -- eve session id
  trigger text not null check (trigger in ('post_turn', 'manual')),
  model text not null,
  input_tokens int,
  output_tokens int,
  extractions_attempted int not null default 0,
  extractions_applied int not null default 0,
  extractions_staged int not null default 0,
  duration_ms int,
  created_at timestamptz not null default now()
);
```

### 4.6 New events

```typescript
// Add to packages/core/src/events.ts
"learning.review_completed": z.object({
  family_id: z.uuid(),
  trigger: z.enum(["post_turn", "manual"]),
  extractions_attempted: z.number().int().min(0),
  extractions_applied: z.number().int().min(0),
  extractions_staged: z.number().int().min(0),
  model: z.string(),
  cost_cents: z.number().min(0),
}),

"learning.extraction_applied": z.object({
  family_id: z.uuid(),
  child_id: z.uuid().optional(),
  kind: z.enum(["memory_fact", "memory_what_works", "profile_interests", "profile_focus"]),
  source: z.enum(["review", "interactive"]),
}),

"learning.extraction_reverted": z.object({
  family_id: z.uuid(),
  review_batch_id: z.uuid(),
  reason: z.enum(["parent_undo", "founder_review", "delta_guard"]),
}),
```

---

## 5. Design: harness-layer learning (NEW)

This is the novel contribution beyond the existing backlog. It introduces a mechanism
for homa to learn from patterns across all families and improve the fleet-wide harness.

### 5.1 What "harness learning" means concretely

| Signal source | What we learn | What improves |
|---|---|---|
| Worksheet feedback (👍/👎 + reason chips) | Which generation approaches land for which age/skill/interest combos | Worksheet generator prompts, skill bank entries |
| Memory/profile patterns across families | Universal teaching patterns (e.g., "phonics-age kids universally benefit from X") | `skill_bank` rows (new or updated), `instructions.md` |
| Tool failure patterns | Recurring tool errors or unhelpful responses | Tool implementations, error handling |
| Conversation dead-ends | Where the model gets stuck or parents get frustrated | Instructions, skill coverage gaps |
| Turn metrics (latency, tool call counts) | Performance bottlenecks | Model routing, tool design |

### 5.2 The harness learning pipeline

```
Daily data → Signal extraction → Pattern aggregation → Candidate improvements → Review
                                                                                    ↓
                                                                          Founder approves
                                                                                    ↓
                                                                          skill_bank / instructions
                                                                          updated (next deploy)
```

**Phase 1 (cohort one, manual):** Sidney reviews aggregated signals weekly. The system
surfaces them; a human decides what to act on.

**Phase 2 (post-revenue):** Semi-automated: the system proposes concrete skill_bank
edits or instruction patches; Sidney approves/rejects.

**Phase 3 (scale):** Automated with guardrails: proposals auto-apply to a canary
cohort, get measured, then roll out fleet-wide.

### 5.3 Signal extraction (the new table)

```sql
-- Aggregated learning signals mined from production data
create table public.harness_signals (
  id uuid primary key default gen_random_uuid(),
  signal_type text not null check (signal_type in (
    'worksheet_feedback',      -- from material 👍/👎 + reason chips
    'skill_gap',               -- model couldn't find a relevant skill
    'tool_failure',            -- tool errored or returned unhelpful result
    'conversation_dead_end',   -- parent re-asked or expressed frustration
    'teaching_pattern',        -- universal pattern across N families
    'instruction_miss'         -- model violated voice/behavior rules
  )),
  -- Anonymized: never stores family-specific content, only patterns
  signal_summary text not null check (char_length(signal_summary) between 10 and 1000),
  evidence_count int not null default 1,  -- how many instances support this signal
  evidence_families int not null default 1,  -- across how many distinct families
  -- What the signal suggests improving
  target_surface text not null check (target_surface in (
    'instructions', 'skill_bank', 'tool', 'worksheet_generator', 'benchmark'
  )),
  target_name text,  -- e.g., skill name, tool name, instruction section
  proposed_action text,  -- natural language: "add a bank skill for..."
  -- Lifecycle
  status text not null default 'open' check (status in (
    'open', 'investigating', 'acted', 'dismissed'
  )),
  acted_at timestamptz,
  acted_by text,  -- 'founder' or 'automated'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No RLS: this is a founder-only ops table
-- Access via admin console or direct query
```

### 5.4 Concrete extraction jobs

**Job 1: Worksheet feedback aggregator** (weekly, automated)
- Query all `material.feedback_given` events from the past week
- Group by worksheet type × age band × skill area
- Flag patterns: "3+ families gave 👎 to handwriting worksheets for 3-year-olds
  with reason 'too hard'" → signal_type='worksheet_feedback',
  target_surface='worksheet_generator'

**Job 2: Memory pattern miner** (weekly, automated)
- Query `family_memories` across all families (anonymized: content patterns only,
  never raw content)
- Identify clusters: if 5+ families all saved memories about the same teaching
  approach working, that's a candidate bank skill
- Example: "6 families saved what-works entries mentioning 'timer' or 'timed
  activities' for focus" → signal_type='teaching_pattern',
  target_surface='skill_bank', proposed_action='Create bank skill: focus-timer
  technique for age 3-6'

**Job 3: Conversation quality scanner** (weekly, automated)
- Look for turns where: parent sent 2+ messages before getting a useful response,
  parent used words indicating frustration ("I already told you", "that's not what
  I meant"), or tool calls failed
- Anonymize and aggregate patterns → surface as signals

**Job 4: Skill coverage gap detector** (weekly, automated)
- Analyze what parents ask for vs what skills exist
- If recurring requests don't match any bank skill, flag as a gap
- Example: "4 families asked about 'morning routine' but no skill covers this"

### 5.5 Anonymization invariant (non-negotiable)

Harness signals must NEVER contain family-specific content. The pipeline:
1. Extracts patterns at the individual level (inside RLS context)
2. Aggregates into anonymized signal summaries (counts, categories, age bands)
3. Only the anonymized aggregate crosses the family boundary into `harness_signals`

This is the same quarantine posture as M3-04 (benchmark research), fleet-wide blast
radius demands structural anonymization, not policy-level promises.

---

## 6. Architecture: how the loops connect

```
                    ┌──────────────────────────────────────┐
                    │         CONTEXT LAYER                 │
                    │    (per-family, gets better for       │
                    │     THIS family with each turn)       │
                    │                                       │
  Mom chats ──────▶ │  turn.started:                        │
                    │    family_memories → instructions     │
                    │    family_skills → available skills   │
                    │    child profile → context block      │
                    │                                       │
                    │  turn.completed:                      │
                    │    post-turn review (M2-13) ─────────▶│─── remember(), update_profile()
                    │    → extracts what the model missed   │    (writes back to same stores)
                    │                                       │
                    └───────────────┬──────────────────────┘
                                    │ anonymized event data
                                    │ (chat.turn_completed,
                                    │  material.feedback_given,
                                    │  learning.extraction_applied)
                                    ▼
                    ┌──────────────────────────────────────┐
                    │         HARNESS LAYER                 │
                    │    (fleet-wide, gets better for       │
                    │     ALL families with each batch)     │
                    │                                       │
                    │  Weekly extraction jobs:              │
                    │    worksheet feedback aggregator      │
                    │    memory pattern miner               │
                    │    conversation quality scanner       │
                    │    skill coverage gap detector        │
                    │           │                           │
                    │           ▼                           │
                    │    harness_signals table              │
                    │           │                           │
                    │           ▼                           │
                    │    Founder review (Phase 1)           │
                    │           │                           │
                    │           ▼                           │
                    │    skill_bank updates                 │
                    │    instructions.md patches            │
                    │    tool improvements                  │
                    │    → deployed to all families         │
                    │                                       │
                    └──────────────────────────────────────┘
```

---

## 7. Sequencing: what to build when

### Phase 1: Context loop MVP (aligns with M2-13, Phase C in backlog)

**Prerequisites:** Family memories and skills already built. `chat.turn_completed`
event exists.

**Build:**
1. `profile_revisions` table + migration
2. `learning_reviews` table + migration
3. Post-turn review job: eve `turn.completed` hook → spawn background extraction
   using a cheap model with digest + reduced toolset
4. Review prompt (from §4.3)
5. Delta guards: stage writes exceeding thresholds
6. Three new events (`learning.review_completed`, `learning.extraction_applied`,
   `learning.extraction_reverted`)
7. UI: "Homa noticed..." aside after review-sourced writes, with undo button

**Size:** L (per existing backlog estimate for M2-13). This is the same ticket,
with concrete implementation details now filled in.

**Dependency:** M2-14 (injection scanning) should land first or simultaneously,
the review prompt's output re-enters the context layer, so it needs the same
scanning defenses.

### Phase 2: Harness signal collection (NEW, post-M2-13, pre-revenue)

**Prerequisites:** M2-13 running in production. Material feedback events (MJ-11)
shipping. Multiple families generating traces.

**Build:**
1. `harness_signals` table + migration
2. Worksheet feedback aggregator (script, runs weekly via dispatcher)
3. Founder signal review: either in the Monday dashboard (FR-11) or as a
   standalone admin page showing open signals with proposed actions
4. Manual skill_bank promotion workflow: signal → founder writes bank skill →
   publishes → all families see it next turn

**Size:** M. Most of the value is in the aggregation queries, not new infrastructure.

### Phase 3: Pattern mining (post-revenue, when N ≥ 20 families)

**Prerequisites:** Phase 2 running. Enough data density for patterns to be real.

**Build:**
1. Memory pattern miner job
2. Conversation quality scanner
3. Skill coverage gap detector
4. Semi-automated proposals: system drafts bank skill markdown, founder
   edits and publishes

**Size:** L. This is where the flywheel starts spinning.

### Phase 4: Closed-loop automation (post-GA, when N ≥ 100 families)

**Build:**
1. Canary deployment: proposed harness changes apply to a subset of families
2. A/B measurement: does the change improve WLF, material feedback rates,
   or efficacy-loop completions?
3. Auto-promotion: changes that clear the measurement bar roll out fleet-wide

**Size:** XL. This is the moat at scale.

---

## 8. The moat argument

Why this matters strategically, not just technically:

1. **Context compounding:** Every family that uses homa for a month has a rich
   profile that no competitor can replicate. Switching costs are real because the
   alternative starts from zero knowledge of the child.

2. **Harness compounding:** After 100 families and 6 months of harness learning,
   homa's instructions, skills, and generators encode thousands of real teaching
   interactions. A new entrant starts with generic prompts.

3. **The flywheel no competitor can shortcut:** Family #200's day-one experience
   is qualitatively different from family #1's, because the harness has been
   sharpened by 199 families' worth of traces. This is exactly the Replit article's
   point: "improvements you can ship daily" that compound into an uncatchable lead.

4. **The network effect without the network:** Each family's usage improves the
   product for all families, without needing families to interact with each other.
   This is a data network effect, the strongest kind.

---

## 9. Relation to existing backlog tickets

| Existing ticket | Relation to this design |
|---|---|
| **M2-13** (post-turn learning review) | This design IS the M2-13 implementation spec. §4 fills in the concrete details. |
| **M2-14** (injection defense) | Prerequisite. Review output re-enters context; scanning must be live. Already built for memory writes (`scanMemoryContent`). |
| **M2-15** (recall_conversations) | Complementary. Recall gives the primary model access to past conversations; the review job uses the same data for extraction. Share the index. |
| **M3-04** (benchmark research) | Same quarantine pattern. Harness signals (§5) follow the same anonymization-first principle. |
| **M3-11** (efficacy loop) | Context learning improves the efficacy loop's inputs. Better profiles → better material targeting → clearer before/after attribution. |
| **MJ-11** (material feedback reasons) | Key input signal for harness learning. The 👍/👎 + reason chips are the highest-signal harness feedback. |
| **FR-11** (founder ops dashboard) | Harness signals surface in the Monday dashboard as "improvement opportunities this week." |

No existing tickets need to change. This design adds one new workstream (harness-layer
learning, Phases 2-4) that sequences naturally after M2-13 and before public GA.

---

## 10. Open questions for Sidney

1. **Phase 1 model choice:** Haiku 3.5 for the post-turn review, or a different
   cheap model? The Hermes pattern uses the same model for cache hits on warm
   transcripts, worth testing both approaches.

2. **Visibility level:** Should review-sourced memory writes be silent, or should
   the parent see "Homa noticed: Fridays are co-op days" with an undo option?
   Hermes offers off/on/verbose. Recommendation: **on** (brief aside, one-tap undo)
   per the existing instructions.md pattern.

3. **Harness signal cadence:** Weekly review of fleet-wide signals, or should some
   high-confidence signals (e.g., tool failures) alert immediately?

4. **Phase 2 priority:** Should harness-layer learning start as soon as M2-13 is
   stable, or wait for post-revenue when there's enough family density for
   meaningful patterns?
