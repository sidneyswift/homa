# Production preparation baseline

Status: founder approved the production test on September 14, 2026; all six
messages completed. Results: [production latency baseline](2026-09-14-production-latency-baseline.md).
Owner: gh#1171. The approval boundary below is retained as historical evidence.

The target remains Send to first visible useful answer within five seconds for
19 of 20 normal replies, Astra medium, including app preparation and reasoning.
The preceding goal turn made progress: it implemented and verified a hosted
two-copy experiment, retained a failed activation, and established that app
preparation alone exceeded five seconds on the short-answer pair. This turn
adds direct platform evidence that changes the next experiment.

## Finding-unknowns pass

The apparent task is to shorten several seconds of preparation. The actual task
first requires separating preview infrastructure behavior from live user
behavior, then changing the part of the live path that is responsible.

Three landmines, one platform-confirmed startup event, one pending access decision.

### Preview startup is not production startup

For the candidate phonics request from source `c6c59c3e`, Vercel's authenticated
request panel reports route `/eve/__server`, Node 24, peak concurrency one,
405MB peak memory, and **Cold (2.37s)**. Request ID:
`frjnl-1789344816315-9f06959afc2a`, deployment
`dpl_7EwNSG9QfyRX7hVk1GSg2oHaiXkB`. Request receipt to Homa's authentication
start was 3.893s. Authentication then took 138ms and membership 99ms.
Do not add the platform cold-start time to the receipt-to-auth interval; they
overlap. The panel separately reports 3.14s execution and 4.6s total response.

[Vercel's current Fluid documentation](https://vercel.com/docs/fluid-compute)
states that bytecode caching is production-only and describes function
prewarming on production deployments. Its
[scale-to-one explanation](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts)
describes prewarming for Pro and Enterprise production. These are platform
capabilities, not proof of Homa's current warm state or a guaranteed latency.

Constraint: inspect the live app before attributing preview startup delays to
ordinary production users. Preserve cold observations and verify startup type
from the actual request instead of assuming it from deployment age.

### Authentication measurements are not all on the blocking path

Admission POST and the separate streaming GET both authenticate. Their timing
records must be joined to the request path and ID. A concurrent stream lookup
cannot automatically be counted as a serial wait before the model starts.
The binding read precedes admission and protects against stale cross-tab
cursors (`app/app/web-session-restoration.ts`). Removing it based on an
unattributed aggregate would risk replaying the wrong turn.

Constraint: retain fresh authentication, caller-scoped membership and durable
cursor checks. Attribute each measured interval to the exact request before
choosing a change.

### Source and fixture state differ across environments

Production is source `2e67c7f13a0e67b3b8d726c6615180dc94db71ce`, deployment
`dpl_HJ8w7KiwbdjFEcPxeorznh9mDQ7i`, READY at the fresh preflight. Its tracked
`agent/model.ts` and `agent/agent.ts` configure Astra medium. It does not contain
all later preview optimizations. A production measurement therefore establishes
a live baseline, not a same-source causal comparison of environments.

Previously used families also carry durable cursors for their preview sessions.
Fresh fixture identities avoid mistaking cross-deployment restoration for the
live app's normal preparation time.

Constraint: use two new reserved synthetic families and record the exact live
deployment. Do not move real households or reuse a preview-pinned cursor.

## Concrete test awaiting approval

1. Use the existing reviewed fixture utility to create two reserved synthetic
   accounts/families in the live Supabase project, each with a synthetic parent
   and one eight-year-old child. Registry names: `prodprepa`, `prodprepb`.
2. Sign into `https://thankshoma.com` through the normal UI and send these three
   messages once per family, in this order:
   - What is one simple way to practice counting to ten without a worksheet?
   - Alex can say the numbers to ten but sometimes skips an object when counting. What is one easy activity we can try?
   - What does phonics mean? Answer in one short sentence.
3. Observe each Send continuously with the existing viewport observer. Retain
   all six outcomes, errors, early notices, cold starts and timeouts. No health
   warmup, automatic resend, model change, or excluded first request.
4. Wait for the complete turn before the next Send. Verify useful-answer content
   separately from first text; an acknowledgement never passes the target.
5. Read only the exact fixture families' saved messages, model usage, tool
   records and matching runtime logs. Check Vercel's actual startup details.
6. Sign out both families and close their test tabs. Retain fixtures and evidence
   under the task's existing retention policy. Record results on gh#1171.

Data effects: two durable synthetic accounts/families and child records, six
user turns with model replies, their usage/continuity records, and any
fixture-scoped observations or memories produced by those prompts. The save
followup intentionally exercises a real synthetic Progress update. There is no
deployment, schema change, environment change, or contact with another person.
The six messages may use multiple paid model calls; the user has authorized
paid testing, but production test data requires the additional approval below.

Stop before creating either fixture until explicit production-test approval is
received. If approved, create and run the six-message live baseline, then choose
the next implementation from its observed delays. This diagnostic baseline is
not a replacement for the eventual representative 19-of-20 acceptance test.

## Approval boundary and evidence

Automatic approval review rejected the fixture-creation command before process
creation. It stated that durable synthetic families in production exceeded the
existing preview-only authorization and cited repository restrictions on
production testing. No process or fixture creation occurred for that command.
Do not bypass this through existing accounts, an indirect tool, or a different
transport. The live experiment awaits explicit founder approval.

Evidence directory: `/private/tmp/homa-preparation-startup-20260914/`.
It contains the fresh production identity and the authenticated Vercel request
panel snapshots, including the expanded Fluid cold-start details. No production
test samples exist at protocol preparation time.
