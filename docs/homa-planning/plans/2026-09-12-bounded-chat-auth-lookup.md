# Bound chat authentication lookup delays

Tracking: [#1171](https://github.com/sidneyswift/homa/issues/1171). This change
targets authentication stalls, while the five-second visible-answer investigation
remains open. Astra stays on medium.

## Observed failure

On September 12, a synthetic hosted chat request spent 5,044 ms authenticating
and returned HTTP 503 before model admission. Request
`wp6p4-1789245906369-6efc0d5b967b` started at 20:45:06.369 UTC on deployment
`dpl_2C9AYfKsrhc1TeEhCtZZ7HhsVRk4`. A later explicit retry completed. Other
completed fresh turns took 8.2 and 8.5 seconds to show useful answer text, so
authentication recovery alone cannot establish the five-second target.

## Implementation

Keep Supabase SDK `getUser()` as the fresh identity authority. A request-scoped
fetch wrapper bounds only GET to the exact configured `/auth/v1/user` URL:
at most two attempts, 1,250 ms per attempt, and 2,500 ms overall, including
response-body reading. A timed-out operation receives an abort signal. A second
attempt waits for client fetch/body cancellation to settle. If the transport
ignores cancellation, stop at the overall deadline without a replacement or
late authorization. This does not prove the remote server stopped processing.

Retry transport TypeError and 502/503/504/520 responses. Do not retry a received
Retry-After response, a valid denial, or other unselected status. A stalled
denial body preserves the denial status. Exhausted temporary failures retain
the existing 503, Retry-After 1, and no-store response path.

Apply the wrapper to Eve bearer admission and the existing chat-binding
`transientAuthErrors: "throw"` opt-in for bearer and cookie clients. Other API
callers retain their current behavior. Cookie refresh POSTs, tenant-scoped
membership reads, JWT verification, and Eve POST admission are unchanged.
Refresh and proxy time can precede the bounded GET and sit outside its budget.
The browser's existing three binding attempts can therefore make up to six
physical Auth GETs. No chat message or tool effect is replayed by this wrapper.

## Validation and release evidence

The isolated candidate passed 136 tests across 19 suites using the installed
Supabase and Eve authentication code with controlled fetch. Cases include body
stalls, cancellation that settles or is ignored, denial and rate-limit handling,
Request/init signal precedence, real cookie refresh, tenant-scoped API resolution,
and zero model admission after exhausted authentication. The pre-change tenant
isolation guard also passed against disposable fixtures and completed cleanup.

Integrated validation passed: 136 context tests, 289 continuity tests, 26
auth-recovery tests, 323 chat tests, 129 mobile-chat tests, the two-tab browser
test, web typecheck, lint (five existing warnings), the Vercel-mode Eve build,
and the stream-duration, empty-delivery and ordered-stream guards. The two-tab
test initially could not bind its localhost server inside the sandbox; it
passed with that local server permitted. Hosted verification must confirm normal
chat admission and record new timing observations; controlled tests establish
failure-branch behavior, not real-world recovery probability. Status and exact
release evidence belong on #1171. This document makes no production or
five-second reliability claim before that verification.
