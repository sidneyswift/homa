# Hermes Agent v0.17.0 — Implementation Notes

Source tree: `/Users/sidneyswift/Documents/Projects/Sidney/homa/homa-research/homa-sources/hermes-agent` (`pyproject.toml` confirms `0.17.0`).

There is **no separate “review system prompt”**. The review fork reuses the parent’s cached system prompt and replays conversation history, then appends the review instructions as a **user message** to `run_conversation()`.

---

## 1. Background self-improvement review

### Where it lives

| Piece | File |
|---|---|
| Prompts, digest, thread worker | `agent/background_review.py` |
| Thread spawn wrapper | `run_agent.py` (`_spawn_background_review`) |
| Memory trigger (user-turn counter) | `agent/turn_context.py` |
| Skill trigger + spawn at turn end | `agent/turn_finalizer.py` |
| Skill iteration counter | `agent/conversation_loop.py`, reset in `agent/tool_executor.py` |
| Write staging | `tools/write_approval.py` |
| Skill write guards in review | `tools/skill_manager_tool.py` (`_background_review_write_guard`) |

### When it runs / when it’s skipped

**Memory review** — counted in **user turns**, default interval **10** (`memory.nudge_interval` in config):

```291:298:agent/turn_context.py
    should_review_memory = False
    if (agent._memory_nudge_interval > 0
            and "memory" in agent.valid_tool_names
            and agent._memory_store):
        agent._turns_since_memory += 1
        if agent._turns_since_memory >= agent._memory_nudge_interval:
            should_review_memory = True
            agent._turns_since_memory = 0
```

Defaults from init:

```1203:1211:agent/agent_init.py
    agent._memory_nudge_interval = 10
    ...
            agent._memory_nudge_interval = int(mem_config.get("nudge_interval", 10))
```

**Skill review** — counted in **tool-loop iterations** since last `skill_manage`, default interval **10** (`skills.creation_nudge_interval`):

```435:441:agent/turn_finalizer.py
    _should_review_skills = False
    if (agent._skill_nudge_interval > 0
            and agent._iters_since_skill >= agent._skill_nudge_interval
            and "skill_manage" in agent.valid_tool_names):
        _should_review_skills = True
        agent._iters_since_skill = 0
```

Foreground `skill_manage` resets the counter mid-turn:

```318:322:agent/tool_executor.py
        if function_name == "memory":
            agent._turns_since_memory = 0
        elif function_name == "skill_manage":
            agent._iters_since_skill = 0
```

**Spawn gate** (after response delivered):

```451:461:agent/turn_finalizer.py
    if final_response and not interrupted and (_should_review_memory or _should_review_skills):
        try:
            agent._spawn_background_review(
                messages_snapshot=list(messages),
                review_memory=_should_review_memory,
                review_skills=_should_review_skills,
            )
        except Exception:
            pass  # Background review is best-effort
```

Skipped when: no `final_response`, turn was **interrupted**, neither trigger fired, memory disabled / tool absent, or intervals set to `0`.

### Cost controls

1. **Daemon thread**, stdout/stderr redirected to `/dev/null`.
2. **Same model as parent by default** → full transcript replay hits warm prefix cache.
3. **Optional cheaper aux model** via `auxiliary.background_review.{provider,model}` → `routed=True` → **digest instead of full transcript**:

```33:41:agent/background_review.py
# The review fork runs on the MAIN model by default ("auto"), replaying the
# full conversation — already warm in the prompt cache, so cheap cache reads.
# ...
# Same model -> full replay; different model ->
# digest. That's the whole policy.
```

4. Review fork: `max_iterations=16`, `compression_enabled=False`, `_memory_nudge_interval=0`, `_skill_nudge_interval=0` (no recursive review).
5. `skip_memory=True` on fork — no external memory provider side effects; only built-in `MEMORY.md`/`USER.md` via shared `_memory_store`.
6. Tool whitelist: only `memory` + `skill_manage` tools (runtime deny for everything else).

### Inputs: full transcript vs digest

**Same model (not routed):** `messages_snapshot` verbatim.

**Routed aux model:** `_digest_history(messages_snapshot, tail=24)`:

```111:152:agent/background_review.py
def _digest_history(messages_snapshot: List[Dict], tail: int = 24) -> List[Dict]:
    ...
    keep = msgs[-tail:]
    while keep and isinstance(keep[0], dict) and keep[0].get("role") == "tool":
        tail += 1
        ...
    old = msgs[:-len(keep)]
    ...
        if role == "user" and text:
            lines.append(f"USER: {text[:300]}")
        elif role == "assistant":
            ...
                lines.append(f"ASSISTANT[tools: {', '.join(names)}]")
            if text:
                lines.append(f"ASSISTANT: {text[:200]}")
    digest = {
        "role": "user",
        "content": (
            "[Earlier conversation digest — older turns summarised to bound the "
            "review's cold-write cost on the routed aux model. Recent turns "
            "follow verbatim below.]\n" + "\n".join(lines)
        ),
    }
    return [digest] + keep
```

Selection at call site:

```743:757:agent/background_review.py
                _review_history = (
                    _digest_history(messages_snapshot) if _routed
                    else messages_snapshot
                )
                review_agent.run_conversation(
                    user_message=(
                        prompt
                        + "\n\nYou can only call memory and skill "
                        "management tools. Other tools will be denied "
                        "at runtime — do not attempt them."
                    ),
                    conversation_history=_review_history,
                )
```

### Review prompts (exact text — pick one based on triggers)

Prompt selection:

```854:859:agent/background_review.py
    if review_memory and review_skills:
        prompt = getattr(agent, "_COMBINED_REVIEW_PROMPT", _COMBINED_REVIEW_PROMPT)
    elif review_memory:
        prompt = getattr(agent, "_MEMORY_REVIEW_PROMPT", _MEMORY_REVIEW_PROMPT)
    else:
        prompt = getattr(agent, "_SKILL_REVIEW_PROMPT", _SKILL_REVIEW_PROMPT)
```

**Memory-only prompt:**

```159:168:agent/background_review.py
_MEMORY_REVIEW_PROMPT = (
    "Review the conversation above and consider saving to memory if appropriate.\n\n"
    "Focus on:\n"
    "1. Has the user revealed things about themselves — their persona, desires, "
    "preferences, or personal details worth remembering?\n"
    "2. Has the user expressed expectations about how you should behave, their work "
    "style, or ways they want you to operate?\n\n"
    "If something stands out, save it using the memory tool. "
    "If nothing is worth saving, just say 'Nothing to save.' and stop."
)
```

**Skill-only prompt** (long — key structural sections):

```170:273:agent/background_review.py
_SKILL_REVIEW_PROMPT = (
    "Review the conversation above and update the skill library. Be "
    "ACTIVE — most sessions produce at least one skill update, even if "
    "small. A pass that does nothing is a missed learning opportunity, "
    "not a neutral outcome.\n\n"
    "Target shape of the library: CLASS-LEVEL skills, each with a rich "
    "SKILL.md and a `references/` directory for session-specific detail. "
    ...
    "Do NOT capture (these become persistent self-imposed constraints "
    "that bite you later when the environment changes):\n"
    "  • Environment-dependent failures: missing binaries, fresh-install "
    "errors, post-migration path mismatches, 'command not found', "
    ...
    "  • One-off task narratives. A user asking 'summarize today's "
    "market' or 'analyze this PR' is not a class of work that warrants "
    "a skill.\n\n"
    ...
    "'Nothing to save.' is a real option but should NOT be the "
    "default. If the session ran smoothly with no corrections and "
    "produced no new technique, just say 'Nothing to save.' and stop. "
    "Otherwise, act."
)
```

**Combined prompt** merges memory + skill sections (`_COMBINED_REVIEW_PROMPT`, lines 275–358 in same file).

### Output “schema”

No JSON schema. Expected outputs:

1. Free text ending in **`Nothing to save.`** (early stop), or
2. Successful **`memory`** / **`skill_manage`** tool calls.

User-visible summary built by scanning tool results (`summarize_background_review_actions`), with modes `display.memory_notifications`: `off` | `on` | `verbose`.

### Write staging / approval

Origin tagged on review fork:

```656:657:agent/background_review.py
            review_agent._memory_write_origin = "background_review"
            review_agent._memory_write_context = "background_review"
```

Gate logic (`memory.write_approval` / `skills.write_approval`, default **off**):

```264:289:tools/write_approval.py
    Decision matrix:
        gate off (default)                    → allow (writes flow freely)
        gate on, memory + interactive CLI     → inline approve/deny prompt
        gate on, memory + gateway/script/bg   → stage
        gate on, skills (any origin)          → stage (too big to review inline)
    ...
    if subsystem == SKILLS or background:
        where = "/skills pending" if subsystem == SKILLS else "/memory pending"
        return GateDecision(
            stage=True,
            message=(
                f"Staged for approval ({subsystem}.write_approval is on). "
                f"Not yet saved — review with {where}."
            ),
        )
```

Staged to `~/.hermes/pending/{memory,skills}/<8-char-uuid>.json`.

Memory tool returns when staged:

```820:824:tools/memory_tool.py
    return json.dumps(
        {"success": True, "staged": True, "pending_id": record["id"],
         "message": decision.message},
        ensure_ascii=False,
    )
```

### Junk-memory / junk-skill filters (beyond prompts)

| Filter | Mechanism |
|---|---|
| Prompt negatives | Skill prompt blocks env failures, “tool X is broken”, one-off tasks |
| System `MEMORY_GUIDANCE` | Injected when memory enabled — blocks task progress, PR numbers, imperatives |
| Char budget | 2200 / 1375 — forces consolidation |
| Exact dedupe on add | `content in entries` → no-op success |
| Threat scan on write | `scope="strict"` blocks injection/exfil patterns |
| Snapshot sanitization at load | Poisoned entries → `[BLOCKED: …]` placeholder in system prompt only |
| Background skill guards | Refuses edit of bundled, hub-installed, external-dir, **pinned** skills in review fork |

Foreground guidance (also shapes what review model was trained on in-session):

```144:165:agent/prompt_builder.py
MEMORY_GUIDANCE = (
    "You have persistent memory across sessions. Save durable facts using the memory "
    "tool: user preferences, environment details, tool quirks, and stable conventions. "
    ...
    "Do NOT save task progress, session outcomes, completed-work logs, or temporary TODO "
    "state to memory; use session_search to recall those from past transcripts. "
    "Specifically: do not record PR numbers, issue numbers, commit SHAs, 'fixed bug X', "
    ...
    "Imperative phrasing gets re-read as a directive in later sessions and can "
    "cause repeated work or override the user's current request. Procedures and "
    "workflows belong in skills, not memory."
)
```

---

## 2. Memory tool

### Core constants

```59:59:tools/memory_tool.py
ENTRY_DELIMITER = "\n§\n"
```

Limits (configurable via `memory.memory_char_limit` / `memory.user_char_limit`):

```124:128:tools/memory_tool.py
    def __init__(self, memory_char_limit: int = 2200, user_char_limit: int = 1375):
        ...
        self.memory_char_limit = memory_char_limit
        self.user_char_limit = user_char_limit
```

Files: `~/.hermes/memories/MEMORY.md` (agent notes), `USER.md` (user profile).

### Tool schema (OpenAI function schema)

Full schema at `MEMORY_SCHEMA` in `tools/memory_tool.py` (lines 1005–1070). Key fields:

- **`target`**: required enum `memory` | `user`
- **`action`**: `add` | `replace` | `remove` (single-op)
- **`operations`**: preferred batch shape — atomic, final-budget check
- **`old_text`**: substring match for replace/remove (not full entry, not ID)

Description embeds consolidation instructions:

```1007:1027:tools/memory_tool.py
    "description": (
        "Save durable facts to persistent memory that survive across sessions. Memory is "
        "injected into every future turn, so keep entries compact and high-signal.\n\n"
        "HOW: make ALL your changes in ONE call via an 'operations' array ..."
        ...
        "IF FULL: an add is rejected with the current entries shown. Reissue as ONE batch that "
        "removes or shortens enough stale entries and adds the new one together.\n\n"
        ...
        "SKIP: trivial/obvious info, easily re-discovered facts, raw data dumps, task progress, "
        "completed-work logs, temporary TODO state (use session_search for those). Reusable "
        "procedures belong in a skill, not memory."
    ),
```

### Error flow when full

Single add overflow:

```331:344:tools/memory_tool.py
            if new_total > limit:
                current = self._char_count(target)
                return {
                    "success": False,
                    "error": (
                        f"Memory at {current:,}/{limit:,} chars. "
                        f"Adding this entry ({len(content)} chars) would exceed the limit. "
                        f"Consolidate now: use 'replace' to merge overlapping entries into "
                        f"shorter ones or 'remove' stale or less important entries (see "
                        f"current_entries below), then retry this add — all in this turn."
                    ),
                    "current_entries": entries,
                    "usage": f"{current:,}/{limit:,}",
                }
```

Batch final-budget check:

```539:552:tools/memory_tool.py
            new_total = len(ENTRY_DELIMITER.join(working)) if working else 0
            if new_total > limit:
                ...
                return {
                    "success": False,
                    "error": (
                        f"After applying all {len(operations)} operations, memory would be at "
                        f"{new_total:,}/{limit:,} chars -- over the limit. Remove or shorten more "
                        f"entries in the same batch (see current_entries below), then retry."
                    ),
                    "current_entries": self._entries_for(target),
                    "usage": f"{current:,}/{limit:,}",
                }
```

Success response is **terminal** (anti-thrash):

```592:608:tools/memory_tool.py
        resp = {
            "success": True,
            "done": True,
            ...
        }
        ...
        resp["note"] = "Write saved. This update is complete — do not repeat it."
```

### Dedupe logic

On load:

```155:157:tools/memory_tool.py
        self.memory_entries = list(dict.fromkeys(self.memory_entries))
        self.user_entries = list(dict.fromkeys(self.user_entries))
```

On add (exact match):

```323:325:tools/memory_tool.py
            if content in entries:
                return self._success_response(target, "Entry already exists (no duplicate added).")
```

Batch add skips duplicates idempotently:

```498:499:tools/memory_tool.py
                    if content in working:
                        continue  # idempotent -- skip duplicate, don't fail the batch
```

Replace/remove: substring match `old_text in e`; ambiguous if multiple **distinct** entries match.

### Security scanning (`tools/threat_patterns.py`)

Memory writes use **`scope="strict"`** (broadest pattern set):

```78:80:tools/memory_tool.py
def _scan_memory_content(content: str) -> Optional[str]:
    """Scan memory content for injection/exfil patterns. Returns error string if blocked."""
    return _first_threat_message(content, scope="strict")
```

**Full regex list** (`_PATTERNS` tuples: `(regex, pattern_id, scope)`):

```49:121:tools/threat_patterns.py
_PATTERNS: List[Tuple[str, str, str]] = [
    # ── Classic prompt injection (applies everywhere) ────────────────
    (r'ignore\s+(?:\w+\s+)*(previous|all|above|prior)\s+(?:\w+\s+)*instructions', "prompt_injection", "all"),
    (r'system\s+prompt\s+override', "sys_prompt_override", "all"),
    (r'disregard\s+(?:\w+\s+)*(your|all|any)\s+(?:\w+\s+)*(instructions|rules|guidelines)', "disregard_rules", "all"),
    (r'act\s+as\s+(if|though)\s+(?:\w+\s+)*you\s+(?:\w+\s+)*(have\s+no|don\'t\s+have)\s+(?:\w+\s+)*(restrictions|limits|rules)', "bypass_restrictions", "all"),
    (r'<!--[^>]*(?:ignore|override|system|secret|hidden)[^>]*-->', "html_comment_injection", "all"),
    (r'<\s*div\s+style\s*=\s*["\'][\s\S]*?display\s*:\s*none', "hidden_div", "all"),
    (r'translate\s+.*\s+into\s+.*\s+and\s+(execute|run|eval)', "translate_execute", "all"),
    (r'do\s+not\s+(?:\w+\s+)*tell\s+(?:\w+\s+)*the\s+user', "deception_hide", "all"),
    ...
    (r'(send|post|upload|transmit)\s+.*\s+(to|at)\s+https?://', "send_to_url", "strict"),
    (r'(include|output|print|share)\s+(?:\w+\s+)*(conversation|chat\s+history|previous\s+messages|full\s+context|entire\s+context)', "context_exfil", "strict"),
    ...
    (r'authorized_keys', "ssh_backdoor", "strict"),
    (r'\$HOME/\.ssh|\~/\.ssh', "ssh_access", "strict"),
    (r'\$HOME/\.hermes/\.env|\~/\.hermes/\.env', "hermes_env", "strict"),
    ...
    (r'(?:api[_-]?key|token|secret|password)\s*[=:]\s*["\'][A-Za-z0-9+/=_-]{20,}', "hardcoded_secret", "strict"),
]
```

**Invisible Unicode blocklist:**

```127:145:tools/threat_patterns.py
INVISIBLE_CHARS = frozenset({
    '\u200b',  # zero-width space
    '\u200c',  # zero-width non-joiner
    ...
    '\u2069',  # pop directional isolate
})
```

Block message format:

```243:251:tools/threat_patterns.py
    if pid.startswith("invisible_unicode_"):
        ...
        return f"Blocked: content contains invisible unicode character {codepoint} (possible injection)."
    return (
        f"Blocked: content matches threat pattern '{pid}'. "
        f"Content is injected into the system prompt and must not contain "
        f"injection or exfiltration payloads."
    )
```

### Frozen snapshot pattern

System prompt uses snapshot from session start; tool responses show live state (`_system_prompt_snapshot` vs `memory_entries`).

---

## 3. Session search (FTS5)

### SQLite schema

Core tables (`hermes_state.py`):

```682:702:hermes_state.py
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    role TEXT NOT NULL,
    content TEXT,
    ...
    active INTEGER NOT NULL DEFAULT 1,
    compacted INTEGER NOT NULL DEFAULT 0
);
```

**FTS5 virtual table** (unicode61 tokenizer) — indexes `content + tool_name + tool_calls`:

```737:759:hermes_state.py
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    content
);

CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, content) VALUES (
        new.id,
        COALESCE(new.content, '') || ' ' || COALESCE(new.tool_name, '') || ' ' || COALESCE(new.tool_calls, '')
    );
END;
...
```

**Trigram FTS5** for CJK substring search:

```766:770:hermes_state.py
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts_trigram USING fts5(
    content,
    tokenize='trigram'
);
```

DB path: `~/.hermes/state.db` (per profile).

### Three calling shapes (+ read bonus)

Implemented in `tools/session_search_tool.py`:

| Shape | Args | Behavior |
|---|---|---|
| **Discovery** | `query=...` | FTS5 → dedupe by lineage → anchored view per hit |
| **Scroll** | `session_id` + `around_message_id` | `get_messages_around`, ±`window` (default 5, max 20) |
| **Browse** | no args | Recent sessions via `list_sessions_rich` |
| **Read** (4th) | `session_id` only | First 20 + last 10 messages |

Precedence: scroll > read > browse/discover.

### Discovery ranking / limits

- Default **`limit=3`**, clamped **`[1, 10]`**
- Internal FTS scan: **`_DISCOVER_SCAN_LIMIT = 300`** before lineage dedup
- Default role filter: **`user,assistant`** (excludes tool noise)
- Hidden sources: **`subagent`, `tool`**
- Cron demotion (not exclusion): interactive sessions rank above `source=cron`

```106:120:tools/session_search_tool.py
def _order_for_recall(raw_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        raw_results,
        key=lambda r: 1 if (r.get("source") or "") in _DEMOTED_SESSION_SOURCES else 0,
    )
```

FTS ordering in DB layer:

```3907:3912:hermes_state.py
        if sort_norm == "newest":
            order_by_sql = "ORDER BY m.timestamp DESC, rank"
        elif sort_norm == "oldest":
            order_by_sql = "ORDER BY m.timestamp ASC, rank"
        else:
            order_by_sql = "ORDER BY rank"
```

Snippet markup: `>>>match<<<` via `snippet(messages_fts, 0, '>>>', '<<<', '...', 40)`.

### Result shape for the model

Per discovery hit (`_discover`):

```588:604:tools/session_search_tool.py
        entry = {
            "session_id": hit_sid,
            "when": _format_timestamp(...),
            "source": ...,
            "model": ...,
            "title": ...,
            "matched_role": match_info.get("role"),
            "match_message_id": msg_id,
            "snippet": match_info.get("snippet") or "",
            "bookend_start": [_shape_message(m) for m in (view.get("bookend_start") or [])],
            "messages": [_shape_message(m, anchor_id=msg_id) for m in (view.get("window") or [])],
            "bookend_end": [_shape_message(m) for m in (view.get("bookend_end") or [])],
            "messages_before": view.get("messages_before", 0),
            "messages_after": view.get("messages_after", 0),
        }
```

`get_anchored_view`: **±5** window (default), **±3** bookends (first/last user+assistant prose).

Message slimming:

```123:141:tools/session_search_tool.py
def _shape_message(m: Dict[str, Any], anchor_id: Optional[int] = None) -> Dict[str, Any]:
    entry = {
        "id": m.get("id"),
        "role": m.get("role"),
        "content": m.get("content"),
        "timestamp": m.get("timestamp"),
    }
    ...
    if anchor_id is not None and m.get("id") == anchor_id:
        entry["anchor"] = True
```

### FTS query sanitization

`_sanitize_fts5_query` in `hermes_state.py` (lines 3758–3813): preserves quoted phrases, strips FTS specials, wraps hyphenated tokens in quotes, etc.

---

## 4. Bonus: Cron model snapshot + fail-closed; cron can’t create cron

### Model snapshot at job creation

For **unpinned** agent jobs (`no_agent=False`, no explicit `model`), snapshot current default:

```795:837:cron/jobs.py
def _compute_provider_model_snapshots(...):
    ...
    if normalized_model is None:
        try:
            model_snapshot = _resolve_default_model_snapshot() or None
        ...
    return provider_snapshot, model_snapshot
```

`_resolve_default_model_snapshot()` mirrors scheduler’s unpinned model resolution from `config.yaml` `model.default`.

Pinned jobs (explicit `model` set) → **`model_snapshot: null`**.

### Fail-closed at fire time

In `cron/scheduler.py` `run_job`:

```2383:2435:cron/scheduler.py
        # Provider/model-drift fail-closed guard (#44585).
        ...
        _model_snapshot = (job.get("model_snapshot") or "").strip().lower()
        if _model_snapshot and not (job.get("model") or "").strip():
            _current_model = str(model or "").strip().lower()
            if _current_model and _current_model != _model_snapshot:
                _drift.append(
                    f"model '{_model_snapshot}' -> '{_current_model}'"
                )
        if _drift:
            ...
            raise RuntimeError(
                f"Skipped to prevent unintended spend: global inference config "
                f"drifted since this job was created ({_changes}), and this job "
                f"is unpinned. No inference call was made. To run on the new "
                f"config, pin it explicitly: `cronjob action=update "
                f"job_id={job_id} provider=<provider> model=<model>` "
                ...
            )
```

Same pattern for **`provider_snapshot`** vs current provider. No snapshot on old jobs → guard doesn’t engage (fail-open back-compat).

### Cron sessions cannot create cron jobs

**Enforcement is runtime toolset disable**, not just prompt text:

```115:135:cron/scheduler.py
def _resolve_cron_disabled_toolsets(cfg: dict) -> list[str]:
    """Toolsets a cron-spawned agent must never receive.

    Three protected toolsets are always disabled in cron context:
      - ``cronjob`` — would let a cron-spawned agent schedule more cron jobs
      - ``messaging`` — interactive, needs a live gateway session
      - ``clarify`` — interactive, blocks waiting for user input
    ...
    """
    disabled = ["cronjob", "messaging", "clarify"]
```

Passed when spawning cron agent:

```2494:2495:cron/scheduler.py
            enabled_toolsets=_resolve_cron_enabled_toolsets(job, _cfg),
            disabled_toolsets=_resolve_cron_disabled_toolsets(_cfg),
```

Tool schema also documents the rule:

```873:873:tools/cronjob_tools.py
Important safety rule: cron-run sessions should not recursively schedule more cron jobs.""",
```

Per-job `enabled_toolsets` **cannot bypass** this denylist (#25752).

---

## TypeScript adaptation checklist

1. **Review loop**: turn counters → daemon async task → fork with tool allowlist `{memory, skill_manage}` → user-message prompts (not system) → optional digest when aux model differs.
2. **Memory**: `§`-delimited files, char budgets, batch `operations`, substring `old_text`, strict threat regex set + invisible-char scan, optional approval staging.
3. **Session search**: SQLite FTS5 + triggers, discovery/scroll/browse shapes, lineage dedup, cron demotion, anchored ±5 + bookends ±3.
4. **Cron**: snapshot unpinned provider/model at create; compare at run and skip + alert on drift; hard-disable `cronjob` tool in cron execution context.

