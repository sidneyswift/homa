# Homa planning and decision records

This directory contains Homa's product contract, founder rulings, ticket backlog, dated implementation plans, research, runbooks, and preserved decision history.

Planning documents do not prove current repository behavior or production deployment. Use code, tests, configuration, and migrations for repository truth. Use direct deployment, HTTP, database, and provider observations for production truth.

## Authority

Product policy follows this order:

1. Explicit founder rulings registered in `journeys/10-reconciliation.md` §5.
2. `13-mr-prd.md`, interpreted through its reconciliation notice.
3. Journey specifications.
4. Agent judgment.

A later founder ruling keeps its original dated source and is added to the founder decision registry. A plan, build-log entry, or code change does not become policy merely because it is newer.

## Canonical homes

| Topic | Canonical home | Status |
|---|---|---|
| Engineering entry point and non-negotiable laws | `/BUILD.md` | Current guidance |
| Product contract | `13-mr-prd.md` | Historical cohort-one baseline plus current reconciliation notice |
| Founder rulings and unresolved founder decisions | `journeys/10-reconciliation.md` §5 | Current policy index with dated sources |
| Named implementation tickets | `03-backlog.md` | Current ticket registry; ticket status still requires evidence |
| Decision and implementation chronology | `build-log.md` | Append-only historical record, not a current-state summary |
| Documentation reconciliation | `reconciliation/` | Active audit record until its strict check passes |
| Operational procedures | `runbooks/` | Current only when their prerequisites and commands still verify |
| Design system | `../homa-design/` | Canonical brand and UI source |
| Benchmark evidence | `../homa-benchmarks/` | Dated research corpus with freshness controls |
| Marketing demand engine operations | `/marketing/AGENTS.md` and `/marketing/workflows/demand-engine.md` | Current workflow, with external services verified separately |
| Marketing demand engine decisions | `14-marketing-demand-engine.md` | Approved dated DM1 through DM7 source; DM7 remains open |
| Agentic architecture placement | `15-agentic-architecture.md` | Current founder ruling with time-bounded repository status |

## Document classes

### Product and architecture sources

`00-product-brief.md` through `12-roadmap-okrs.md` are historical planning and research snapshots. Their banners and dates are part of their meaning. `15-agentic-architecture.md` is the current placement ruling, but its implementation and production statuses are time-bounded. `gateway-plan.md` and the journey library preserve product intent and must be read through the founder registry, PRD reconciliation notice, named tickets, and current evidence.

### Dated plans

Files under `plans/` and other files ending in `-plan.md` are implementation records. Each must state whether it is proposed, approved for a named ticket, in progress, completed in the repository, production-verified, superseded, or archived. "Completed" without a repository locator is not a current implementation claim. "Live" without dated production evidence is not a production claim.

### Research and evidence

Files under `icp-research/`, `lead-magnet/`, `materials/calibration/`, and similar research locations preserve dated inputs and prototypes. They do not override the PRD or founder rulings. Volatile prices, laws, provider behavior, and market facts require an observation date and refresh path.

### Historical records

`build-log.md`, `eve-churn-log.md`, tester notes, decision-session records, and superseded plans preserve what was observed or decided at a point in time. Annotate later corrections rather than rewriting the original event. Historical statements must not be copied into current guidance without re-verification.

## Current open policy decisions

- D10: confirm whether "Hegg" means Heggerty before naming the curriculum library.
- DM7: choose invite-scoped email or obtain ongoing-content consent before nurture email is sent.
- Direct printer integration: approve or reject the proposed reversal.
- Minors' media: decide whether child photos and other minors' media are private by default despite global D7.

The exact choices and sources live in `journeys/10-reconciliation.md` §5. These are founder decisions, not gaps an implementation agent may fill.

## Working rule

Start with `/AGENTS.md`, then `/BUILD.md`. Before changing a behavior, read the current ticket and the code that owns it. Before claiming production completion, refresh the relevant evidence under `reconciliation/evidence/` and probe the affected live path.
