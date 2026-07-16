# Homa System Policies

Default policies for the Night Manager and self-improving loops.
Each policy has an autonomy level that controls how much the system
can do without founder approval.

## night_manager_autonomy

The Night Manager's overall autonomy level for taking action.
autonomy: observe

Nights 1-3: observation mode (issues + backlog PRs only).
After that: fix PRs unlock. The founder merges everything.
Auto-merge for trivial green fixes is a later ruling.

## bug_fix_approval

Rules for when the Night Manager can fix bugs automatically.
autonomy: pr_only

- Bugs confirmed by signal classification get a PR opened.
- The founder reviews and merges all PRs.
- Auto-merge only after machine-enforced deploy-law gates pass.

## skill_update_rules

Rules for when skills can be updated based on signal patterns.
autonomy: pr_only

- Pattern must appear 3+ times across 2+ families.
- Skill updates are drafted as PRs, never auto-merged.
- Instruction updates (prompt changes) follow the same PR flow.

## knowledge_gap_fill

Rules for filling knowledge gaps through fleet research.
autonomy: auto_merge_green

- Knowledge gaps from recall misses feed into the research queue.
- Research results go through the existing knowledge_bank gate.
- No founder approval needed for knowledge bank writes (existing flow).

## escalation_thresholds

When to escalate to the founder instead of acting autonomously.
autonomy: observe

Escalate when:
- Churn risk signals appear for 3+ families in 24 hours.
- Bug signals affect 5+ families.
- A proposed fix would change agent instructions or identity.
- Model spend exceeds $10 in a single night run.
- Any change to security, RLS, or tenant isolation code.
