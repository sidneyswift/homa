# Dense scanned curriculum reading, gh#1089 follow-up

The deployed scanned-PDF reader can read and cache instructional pages, but a dense contents spread from a second original repeatedly stopped during transcription. The diagnostic ended after 40,014 ms, matching the inner 40-second model deadline; the enclosing page deadline had not fired. The original remains intact. This correction is not live acceptance of that original.

## Evidence and uncertainty

The installed `ai@7.0.14` resolves `@ai-sdk/gateway@4.0.11` for string model IDs. Its `asGatewayError` recognizes several Undici timeout codes, but a DOM `TimeoutError` falls through to `GatewayResponseError` with status 500. An offline experiment with this installed implementation reproduced that result without an HTTP response. A real synthetic HTTP 500 instead retained an `APICallError` cause. The recorded live status 500 alone therefore cannot distinguish an inner timeout from a provider response; the timing strongly suggests the former, but the old diagnostic did not retain the distinguishing cause.

Gemini 3 Flash defaults to high thinking. This deterministic transcription request previously omitted thinking settings. Google's [Gemini 3 guide](https://ai.google.dev/gemini-api/docs/gemini-3) documents minimal thinking for Flash, and the [AI SDK Google provider contract](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai) places it at `providerOptions.google.thinkingConfig.thinkingLevel`. Minimal does not guarantee zero reasoning tokens. Keep the model, exact source prompt, schema, token ceiling and deadlines; measure the changed request on a synthetic dense spread.

## Parent-facing procedure and placement

The existing `family-librarian` fleet skill owns the procedure: find the family's original, inspect its actual source, identify the requested page or lesson, continue from the returned page cursor, quote only verified source text, and explain any missing coverage. The existing Library intake path supplies bounded metadata so the family can find the original. `get_family_asset`, `read_family_curriculum`, and curriculum mapping's exact quote validation already supply the required effects. No new tool or workflow skill is needed.

This change belongs in the deterministic reader and model-call boundary. They must supply an explicit, bounded transcription request; distinguish a caller abort, our deadline, an actual API failure and invalid output; retain canonical successful pages; and describe exactly where a later model read stopped. Postgres retains page truth under the existing family, asset, source hash and extraction-version identity. The original remains the source of truth in Blob. No context prose or temporary file becomes durable product state.

## Exact change

- Request minimal thinking for the existing Google model, with zero SDK retries and the existing 40-second transcription, 55-second page and outer operation deadlines.
- Classify failures using owned signals first. Only an SDK `APICallError` with a valid numeric HTTP status supplies a provider status. Never expose raw provider bodies, messages, causes, source text or URLs in the typed diagnostic.
- If a later transcription alone times out or receives an API error, preserve earlier nonempty readable or partial evidence. Release the failed page lease without completing it, return its ordinal as the cursor, mark the response truncated, and state that Homa could not finish that page. Recheck source identity and caller cancellation before returning.
- Exact-page failures still fail. Parser, schema, unknown, source identity, cache write/release and caller failures remain failures. Blank or unreadable earlier pages cannot turn a failed source read into success. There is no invented empty canonical page and no automatic retry.
- Metadata can use the already verified earlier pages with an explicit limited-coverage note. This does not make the missing page readable or make the whole curriculum fully mapped. A later explicit read may attempt the missing page and cache a successful canonical result.

## Validation

`check:family-library-ingestion` includes focused transcription tests for deadline-versus-HTTP classification, explicit provider settings, late completion, schema failures, partial page gaps, and accurate metadata coverage. Reader regressions exercise failed later and exact-page reads, explicit subsequent recovery and cache replay, caller abort during final source recheck, invalid output, source loss, database failure and parser limits.

`pnpm eval:family-pdf-dense` uses a disposable local database and artifact store with production write credentials removed. By default it permits at most three paid calls, without retries: a synthetic 2105 by 1488 pixel landscape spread with 24 aligned lesson/title/page rows and 27 source lines, then a matched spread carrying a printed instruction injection, then a damaged page with clear known text around a destroyed paragraph. `--injection-only` and `--uncertainty-only` each cap the run at one call. It verifies exact source quotes and row relationships, physical ordinal, content hash, honest page state, canonical cache replay without a new model call, elapsed time and numeric text/reasoning usage. Optional artifacts contain only this synthetic source and output.

Observed sandbox results on September 6:

| Case | OCR duration | Exact checks | Reported result | Cache replay |
| --- | ---: | --- | --- | --- |
| Dense landscape spread | 5,334 ms | 24 lesson/title/page relations, 27 left-page source lines | Readable, zero gaps, 525 text tokens, zero reasoning tokens | Identical, no new model call |
| Dense spread with printed injection | 4,618 ms | Same source checks; injected sentence copied as data | Readable, zero gaps, 549 text tokens, zero reasoning tokens | Identical, no new model call |
| Damaged paragraph | 2,660 ms | Four clear source quotes and page footer; no invented words in the destroyed area | Partial, one gap, 89 text tokens, zero reasoning tokens | Identical, no new model call |

The first injection attempt is inconclusive: the Mac entered Maintenance Sleep at 13:37:47 EDT for 255 seconds and resumed at 13:42:02, matching the interrupted eval interval. It returned a typed timeout and committed no second page. This is neither a quality failure nor proof of an SDK timeout defect. The separately authorized replacement ran with a process-scoped sleep assertion and recorded 4,620 ms wall time, 4,619 ms monotonic time, and both deadline and page signals un-aborted. The damaged-page test also used that assertion. No persistent power setting changed.

These are three measured synthetic cases, not a reliability estimate or a substitute for the original's live acceptance. Final local checks passed: 93 ingestion tests, web typecheck, full web lint with zero errors and four existing unrelated warnings, focused changed-file lint with zero warnings, isolation, eval isolation, tool deadlines, fleet skills and the style guard. The Next production build and Chromium archive trace guard passed. The Eve build passed using the same co-deployed service signal that CI seeds, and its emitted shared function passed the max-duration guard. The unseeded standalone Eve build had compiled successfully but could not satisfy that emitted-function guard; using the documented CI setup resolved the local setup gap.

The [synthetic evaluation receipt](../evidence/2026-09-06-dense-pdf-eval.json) retains the numeric results and the inconclusive-run explanation. No private original, private URL or family content is committed. Live acceptance still requires a fresh deployed-code attestation and a separately reviewed, bounded retry of the failed original. No schema migration or cache override is needed. Rollback is the previous code; successful canonical pages remain valid source evidence.
