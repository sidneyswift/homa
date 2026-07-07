# Homa Production Usage Report — One-Family Cost Model

> Supersession note (2026-07-06, build-log): $29 and $29 to $49 plan prices
> below are the retired placeholder. Pricing v1 is Homa $19/mo or $99/yr and
> Homa Pro $49/mo, live in Stripe both environments. Competitor prices quoted
> in this doc are facts and stand. Allotments still derive at day 60 (T2).

**Data source:** `/Users/sidneyswift/Documents/Projects/Sidney/homa/homa-macmini/.openclaw`  
**Observation window:** 2026-03-30 → 2026-07-02 (~95 days)  
**Snapshot note:** Gateway logs stop 2026-06-17; cron run files in `cron/runs/` stop 2026-06-14 (migrated), but ambient-learning state continues through 2026-07-02.

---

## 1. Session Volume

| Metric | Value |
|--------|-------|
| Primary session `.jsonl` files | **1,131** |
| Trajectory `.jsonl` files | **1,004** |
| Total `.jsonl` in sessions dir | **2,135** |
| Sessions directory size | **322 MB** |
| Date range (file mtimes) | **2026-03-30 → 2026-07-02** |
| `sessions.json` active records | **193** (175 Slack, 18 unknown) |
| Slack thread/topic sessions | **146** (`-topic-` in filename) |
| Avg new sessions/day | **11.9** |
| Avg messages/day (all sessions) | **217** |

**Main session** (`05b91b74-…`): 1.3 MB, **872 user / 990 assistant** messages, models `claude-opus-4-6`, `claude-opus-4-8`, `gpt-5.5`. This is the long-lived Slack DM + heartbeat container.

**Session size buckets:**

| Bucket | Sessions | LLM calls | Total tokens |
|--------|----------|-----------|--------------|
| Main/heavy (>100 msgs) | 23 | 3,160 | 293M |
| Topic threads (21–100 msgs) | 123 | 2,570 | 167M |
| Cron-like (≤12 msgs, ≤2 users) | 890 | 3,195 | 179M |
| Other | 95 | 676 | 39M |

---

## 2. Token Usage Evidence

Usage is logged per assistant message as `usage: { input, output, cacheRead, cacheWrite, totalTokens, cost? }`.

**Recent ambient-learning cron session** (2026-07-02, `claude-opus-4-8`, null run):

| Call | input | output | cacheRead | cacheWrite | totalTokens |
|------|-------|--------|-----------|------------|-------------|
| Cold start | 2 | 103 | 0 | 52,648 | 52,753 |
| Warm | 2 | 109 | 52,648 | 585 | 53,344 |
| Tool loop | 2 | 645 | 53,233 | 14,600 | 68,480 |
| Tool loop | 2 | 604 | 67,833 | 830 | 69,269 |
| Final | 2 | 112 | 68,663 | 660 | 69,437 |

**Heartbeat sample** (`claude-opus-4-6`): cold ~31K tokens (31K cacheWrite); warm ~32K (31K cacheRead + 144 cacheWrite); cost ~$0.017–0.020/call when logged.

**95-day aggregate (all sessions):**

| Metric | Total | Monthly extrap (×30/95) |
|--------|-------|---------------------------|
| LLM calls with usage | 9,601 | **3,032** |
| Input tokens | 161K | 51K |
| Output tokens | 3.5M | **1.1M** |
| Cache read | 501M | **158M** |
| Cache write | 173M | **55M** |
| Total tokens | 678M | **214M** |

**By model (95 days):**

| Model | Calls | Total tokens | Logged cost |
|-------|-------|--------------|-------------|
| `claude-opus-4-8` | 6,052 (63%) | 455M | **$0.00** (no cost field) |
| `claude-opus-4-6` | 3,272 (34%) | 222M | $226.93 |
| `gpt-5.5` | 19 | 985K | $1.51 |
| `delivery-mirror` | 258 | 0 | $0 |

**June 2026 steady-state month** (best reference — all crons + heartbeat running):

| Category | LLM calls | Tokens |
|----------|-----------|--------|
| Heartbeat | 691 | 83M |
| Cron (isolated sessions) | 2,789 | 158M |
| Interactive | 2,720 | 209M |
| **Total** | **6,200** | **450M** |

---

## 3. Cron & Automation Cost Surface

### Active cron jobs (`jobs.json.migrated`)

| Job | Schedule | Target | Est. runs/day |
|-----|----------|--------|---------------|
| Story Ambient Learning | `:23,:53 7–22` | isolated | ~32 |
| Email Triage Hourly | `:47 7–22` | isolated | ~16 |
| Homa Dashboard Daily | `7:23` | isolated | 1 |
| Homa Journal Prompt | `20:00` | isolated | 1 |
| Daily Janitor | `4:17` | isolated | 1 |
| Story Research Nightly | `2:14` | main | 1 |
| Story Weekly Scoring | weekly | main | ~0.14 |
| Vault Audit / Reaction Retro | weekly | main | ~0.29 |

### Run history

| Source | Count | Date range | Notes |
|--------|-------|------------|-------|
| `cron/runs/*.jsonl` | **2,183** lines | 2026-03-31 → 2026-06-14 | **35.8 runs/day** avg; stops at migration |
| `learning-loop-state.json` | **1,776** runs | through 2026-07-02 | Ambient learning only; ~**30/day** |
| `email-triage-log.jsonl` | **374** lines | 2026-05-03 → 2026-07-02 | ~**6/day** (not full hourly yet) |
| `journal-prompts.jsonl` | **54** lines | 2026-05-06 → 2026-07-02 | Daily prompt; channel error since ~Jun 18 |
| `learning-journal.jsonl` | **194** lines | 2026-05-05 → 2026-07-01 | **Not 115K+** — precise count is 194 |
| `janitor.jsonl` | **1,080** runs | — | Daily janitor script executions |

**June automation triggers (user-role messages):**
- Heartbeat polls: **782** (~26/day)
- Cron triggers: **849** (~28/day)

**True human Slack turns (excluding automation prefixes):**

| Month | Human | Automation |
|-------|-------|------------|
| 2026-03 | 1 | 39 |
| 2026-04 | 41 | 63 |
| 2026-05 | 55 | 117 |
| 2026-06 | **95** | 1,726 |
| 2026-07 (partial) | 4 | 177 |

**Steady-state estimate: ~95 human turns/month (~3/day), heavily skewed to parent (Less) in Slack DMs and #homa-homeschool.**

Each human turn triggers many LLM calls (tool loops, subagents): **~29 LLM calls per human message** in June (2,720 / 95).

---

## 4. Artifact Volume

### `workspace/content/`

| Month | All files | PDFs | HTML worksheets |
|-------|-----------|------|-----------------|
| 2026-03 | 28 | 3 | 1 |
| 2026-04 | 268 | 28 | 13 |
| 2026-05 | 556 | 69 | 54 |
| 2026-06 | 713 | **70** | 0 |
| 2026-07 | 16 | 3 | 0 |
| **Total** | **1,581** | **173** | **68** |

**Monthly artifact rate at peak: ~70 PDFs/month**, plus HTML/interactive worksheets. Content dir is curriculum-heavy (math, literacy, Spanish, co-op materials).

### Other artifacts

| Type | Count | Size |
|------|-------|------|
| Reference images | 36 files | 46 MB |
| Media dir (Slack attachments, outbound PDFs) | 469 files | 728 MB |
| Dashboard scripts | 3 Python scripts | Generated daily, posted to Slack |
| Outbound media PDFs | 46 | Slack-delivered worksheets |

---

## 5. Memory / Stable Context Payload

Per-turn context a cloud version would carry:

| File | Size |
|------|------|
| `story-profile.json` | 64.9 KB |
| `benchmarks/*.md` (16 files) | 286.9 KB |
| `AGENTS.md` | 21.5 KB |
| `TOOLS.md` | 13.4 KB |
| `MEMORY.md` | 6.5 KB |
| `what-works.md` (learners/story/) | 5.4 KB |
| `SOUL.md` | 4.6 KB |
| `USER.md` | 2.3 KB |
| `HEARTBEAT.md` | 2.2 KB |
| **Total** | **407.7 KB (~104K tokens @ 4 chars/token)** |

**Observed cold-start cache write per turn: ~52–61K tokens** — matches stable context + skills snapshot + tool schemas. Warm turns reuse ~52–69K cache read with small incremental writes.

Skills snapshot in `sessions.json` lists 40+ bundled OpenClaw skills (adds significant hidden context beyond the files above).

---

## 6. Gateway Logs

| File | Size | Coverage |
|------|------|----------|
| `gateway.log` | 636 KB | 2026-05-27 → 2026-06-17 |
| `gateway.log.1.gz` | 116 KB | earlier |
| `gateway.err.log.*.gz` | 460 KB combined | rotated errors |

**Pattern counts (gateway.log + .1.gz):**

| Pattern | Count |
|---------|-------|
| Lines total | 16,737 over 79 days |
| "request"/"POST" | 1,005 |
| "error" (broad) | 985 (mostly Slack stale-socket restarts) |
| Anthropic/claude refs | 59 |
| OpenAI/gpt refs | 66 |
| Heartbeat refs | 51 |

Logs are **infra/Slack health**, not token accounting. No reliable request-per-day model call counts post-June 17 in this snapshot.

---

## 7. Voice Usage

| Signal | Count |
|--------|-------|
| `voice-calls/` directory | **Not present** |
| `.m4a` files in `media/` | **105** (~71 MB) |
| `[Audio]` user messages in sessions | **6** |
| Live voice call messages | **2** |
| Voice note refs in `learning-journal.jsonl` | **96** |
| Whisper/transcription refs in sessions | **519** (mostly metadata, not 519 transcriptions) |

Voice is **real but light**: Less sends occasional Slack voice notes → Whisper transcription → ambient learning extracts signals. No heavy phone-call or talk-mode usage in this snapshot.

---

## Monthly Usage Estimate Table

| Metric | 95-day total | Steady-state (Jun-26) | Monthly extrap (30/95) | Confidence |
|--------|-------------|----------------------|------------------------|------------|
| **(a) Human interactive turns** | 196 | **95** (~3/day) | **62** | **High** for Jun; med for avg |
| **(a′) Interactive LLM invocations** | 5,630 | **2,720** | **1,777** | **High** |
| **(b) Heartbeat LLM invocations** | 777 | **691** | **245** | **High** (Jun only since May) |
| **(b′) Cron LLM invocations** | 3,194 | **2,789** | **1,008** | **High** |
| **(b″) Total automation LLM** | 3,971 | **3,480** | **1,253** | **High** |
| **(c) Total tokens** | 678M | **450M** | **214M** | **High** for Jun |
| — cache read | 501M | ~280M est. | 158M | Medium |
| — cache write | 173M | ~95M est. | 55M | Medium |
| — billable in+out | 3.7M | ~2.5M est. | 1.16M | High |
| **(d) PDF artifacts generated** | 173 | **70** | **55** | Medium |
| **(e) Stable context payload** | — | **408 KB / ~104K tok** | per cold turn | **High** |

---

## Pricing Implications ($29–49/mo subscription)

### As-is on Opus (current production mix)

- **Primary model today:** `claude-opus-4-8` (63% of calls)
- **Observed logged API cost:** $228.44 / 95 days → **~$72/mo** — but only 34% of calls had cost fields; Opus 4-8 calls log **$0**
- **Actual current spend is likely $100–200+/mo** on Opus 4-8 at June's 450M tokens/month (heavy cache helps, but 6,200 calls × ~73K avg tokens adds up)
- List-price upper bound (no cache discount): **~$1,350/mo** — not realistic; prompt caching reduces effective cost ~5–10×

### Model remix scenarios

| Scenario | Approach | Est. API cost/mo | Fits $29–49? |
|----------|----------|------------------|--------------|
| **A. As-is Opus** | All calls on Opus 4.8 + caching | $100–200+ | **No** |
| **B. Tiered** | Sonnet/Haiku for heartbeat + cron null-runs; Opus for interactive | $40–80 | **Marginal** at $49 |
| **C. Aggressive** | Haiku for ambient/email triage/dashboard; Sonnet for interactive; Opus only for complex gen | $25–45 | **Yes** at $49 |
| **D. Cap + cache** | Hard monthly turn cap (~100 human, 2000 auto), 5-min cache TTL | Variable | **Yes** with limits |

**Key cost drivers to optimize:**
1. **Ambient Learning** — 32 runs/day × ~69K tokens even on null runs = ~**66M tokens/mo** alone
2. **Heartbeat** — 26/day × ~120K avg = ~**83M tokens/mo** in June
3. **Cold cache writes** — 52K tokens per new isolated cron session; session reuse would help
4. **Tool-loop interactive** — 29 LLM calls per human message; subagent caps would reduce spend

---

## Extrapolation Method & Confidence

**Method:** Direct enumeration of all 1,131 session `.jsonl` files for `usage` fields; timestamp-based monthly bucketing; June 2026 as steady-state anchor (all 9 crons + heartbeat active). Monthly figures use `(30/95) × total` unless June-specific noted.

**Confidence:**
- **High:** Token totals, LLM call counts, model names, session counts, artifact counts
- **Medium:** Monthly cost in dollars (incomplete cost logging on Opus 4-8; cache pricing complex)
- **Low:** Gateway-log-derived request rates (logs stale, infra-focused)
- **Corrected:** `learning-journal.jsonl` = **194 lines**, not 115K+

---

## Summary for Subscription Pricing

One active homeschool family running full Homa automation consumes roughly:

- **~3 human Slack turns/day** (~95/month)
- **~116 automated LLM runs/day** (heartbeat + cron)
- **~450M tokens/month** at peak (June)
- **~70 PDFs/month** generated
- **~408 KB stable context** per cold LLM call

At **$29/mo**, you'd need Scenario C (cheap models for automation) plus strict caps. At **$49/mo**, Scenario B/C with prompt caching is plausible for this usage profile. The family's actual interactive load is modest; **automation overhead (heartbeat + ambient learning) is the dominant cost**, not parent chat volume.

