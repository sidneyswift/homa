# Defer printable browser startup

Status: local verification complete; hosted comparison pending. Owner: gh#1171,
draft PR #1191. Astra remains medium. The target remains Send to first useful
visible answer within five seconds for 19/20 normal replies, including all app
preparation and hidden model work. No production promotion.

## Hypotheses and change

The installed Eve runtime constructs the channel and agent graph before dispatch.
A credential-free probe of the actual compiled entry took 13.907 ms to dispatch
its first unauthenticated request after import, then 0.381 ms on the second.
It returned 401 without network activity. This weakens expensive post-import
routing as the explanation; it does not reproduce hosted authentication or
platform startup.

Module-load instrumentation instead found that plain chat eagerly loaded the
printable browser drivers through lib/materials/render-page.ts. The new literal
dynamic imports load Puppeteer and bundled Chromium when launchBrowser actually
needs them. Existing browser caching, local executable selection, deadlines,
network policy, PDF-to-preview provenance and handwriting validation stay intact.
There are no model, dependency, query, schema or configuration changes.

## Local evidence and limits

- Actual compiled-entry load events fell from 911 to 702, with unique module URLs
  falling from 427 to 243. Puppeteer-core files fell from 127 to zero and Chromium
  files from four to zero. The instrumentation changes loader behavior, so use
  these counts rather than its elapsed times as evidence.
- Uninstrumented local entry imports measured 1366.288 ms before and 387.361 ms
  after, with first unauthenticated dispatch 13.907 and 13.123 ms respectively.
  Disk-cache effects and sequential sampling prevent a causal speed estimate.
- All 19 real Chrome rendering checks pass, including actual PDF/raster and
  handwriting geometry cases. All 546 materials tests pass without skips.
  Web typecheck, targeted lint, Eve build and all three stream-duration checks
  pass. The preceding evidence commit 38d8474b passed CI run 34821646515;
  this is not CI proof for the new change.
- The actual emitted loader region imports both drivers, exposes expected APIs,
  and resolves the packaged Chromium and font archives. This probe has no
  network calls or forbidden effects. It does not launch Linux Chromium on macOS.
- The build remains 142 MB, including a 64,795,438-byte Chromium archive. This
  reduces initialization work, not total deployment size. It cannot by itself
  solve multi-call model waits or establish the hosted five-second target.

Private evidence is in /private/tmp/homa-five-second-active/startup-investigation:
office-admission-dispatch-20260914-01, browser-deferred-admission-20260914-01,
office-module-loads-20260914.json, browser-deferred-module-loads-20260914.json and
printable-browser-build-verification.json. Check logs use
/private/tmp/homa-browser-defer-*.log. The emitted entry SHA256 is
477740dc149b98e4bf6e8fdf266bfce25839d6244baaab07df574b6bd28f0d07.

## Hosted experiment

Build protected previews from committed source, with the same existing inline
turn, deferred tools, deferred indexing and timing flags. Keep warmup, priority,
racing and skill-linked tools off. Retain startup samples, failures, visible
conversation history and useful-prefix reviews. Compare against the Office-only
source; do not call a local import reduction a reply-time improvement. Freeze
the sample protocol before sending. Existing authorization covers synthetic paid
messages and these protected previews, not production promotion.
