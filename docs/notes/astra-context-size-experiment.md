# Astra input-size experiment, September 17, 2026

Status: completed diagnostic experiment, not a production change. Tracks #1171 and draft PR #1198.

The observed results do not establish input length as the cause of Homa's multi-second response delays. A 40,000-token request can begin answering in approximately one second when its input is cached, and approximately 1.5 seconds without a cache hit. Both input sizes can also suffer long waits. Do not treat prompt reduction as a proven latency fix.

## Protocol

- Astra medium through the existing Vercel AI Gateway OIDC connection, local Node 24 client, AI SDK 7.0.14, default gateway routing.
- Start the clock immediately before streamText; stop on the first nonempty response-text delta. Hidden reasoning waiting time is included, but reasoning events never stop the clock.
- Two identical questions across arms: number bond definition with example, and a homeschool introduction. Each appears in three pairs per cache regime.
- Same concise instructions and output limit in both arms; vary the amount of synthetic library-archive background. The shorter archive is a prefix of the longer archive. The instructions say the archive is background, not instructions, and should be used only if relevant.
- Calibrate archive character lengths against returned input-token counts, then freeze lengths before measured requests. Actual measured sizes: 4,995-5,003 and 40,095-40,100 tokens.
- Six pairs with fresh request prefixes, then six pairs with reused prefixes. Alternate small-first and large-first. Fresh identifiers discourage prefix reuse; cache usage verifies the actual state. UUID token lengths vary slightly.
- Two calibration requests and two repeated-prefix warmups excluded. Twenty-four measured requests, zero failures, no retries, no replacement samples. Per-call timeout 120 seconds and output limit 8,192 tokens. Full answers and usage saved for every request.
- This is not browser Send-to-visible timing and does not include Eve, database reads, session preparation, tools, or full Homa instructions.

## Results

Seconds to first answer text. Each row contains six measured replies.

| Actual cache state | Input tokens | Median | Mean | Minimum | Maximum | Under 5 seconds |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| No cache reads | about 5,000 | 1.587 | 4.099 | 1.076 | 10.844 | 4/6 |
| No cache reads | about 40,000 | 1.965 | 2.069 | 1.473 | 3.026 | 6/6 |
| Over 99.8% cache reads | about 5,000 | 2.853 | 3.674 | 1.020 | 9.223 | 5/6 |
| Over 99.9% cache reads | about 40,000 | 1.314 | 3.126 | 1.050 | 10.882 | 5/6 |

Within-pair large-minus-small differences: uncached median +0.327 seconds, mean -2.029 seconds; cached median -1.744 seconds, mean -0.547 seconds. Larger input was slower in four of six uncached pairs and one of six cached pairs. Outliers reverse some comparisons, so neither average nor median alone establishes a general speed advantage.

All 24 measured calls reported zero reasoning tokens with medium configured. This is what the API reported, not proof about unreported internal computation. Even a cached large-input definition took 10.882 seconds, without any app workflow in this experiment. The timer cannot locate that delay inside the local network, gateway, provider queue, or model service.

## Answer review

A manual, unblinded review of all 24 answers found that all 12 definitions described parts and a whole with correct arithmetic examples. All 12 introductions described homeschool help, asked a relevant follow-up, and did not claim to have executed a tool or saved anything. No answer incorporated the irrelevant library archive. Wording and capability lists varied. This is a narrow relevance/correctness review, not a production policy or curriculum-quality evaluation.

The experiment did not remove real Homa instructions. It cannot establish that shortening Homa's actual prompt preserves routing, family context, tool choice, safety, or worksheet quality. Input quantity and instruction content are different variables.

## Decision and limits

Retract any assertion that Homa's approximately 41,000 input tokens are already proven to cause its long waits. This batch supports investigating slow requests across the model service path as well as app preparation, while preserving the distinction between those intervals.

Six observations per condition cannot estimate a reliable 95th percentile. Cache regimes ran sequentially, not interleaved, so comparing them does not isolate the causal benefit of caching from time-varying service conditions. Gateway routing was left at its default. No provider/server timing breakdown was captured. Synthetic library records are not representative of a dense instruction set or tool schemas. The next contextual comparison must use the actual Homa request and evaluate behavior, not replace it with filler and claim equivalence.

OpenAI's current prompt-caching documentation recommends measuring reported cache reads, writes, token counts and latency: https://developers.openai.com/api/docs/guides/prompt-caching . We used reported counts rather than assuming repeated prefixes were cached.

## Reproduction and evidence

Script: `scripts/astra-context-ttft.mjs`. Run with Node 24, `--env` pointing to the existing local OIDC environment and `--out` pointing to a new JSON file. The script loads only OIDC from that file and performs no app database writes. Use a new output path for each run.

Sanitized local evidence directory:
`/Users/sidneyswift/.codex/visualizations/2026/09/12/01a09475-7b96-7372-b5dc-e434c12764ea/context-size-experiment-2026-09-17/`

- `results.json`: all 28 calls, including calibration/warmups, exact answers, input hashes and token/cache usage.
- `summary.json`: group summaries and all 12 pairwise comparisons.
- `findings.md`: this report.
- `astra-context-ttft.mjs`: reproducible benchmark source snapshot.

Validation: Node syntax check, completed live 24-request measurement batch, and git whitespace check. No application/runtime files changed. No production deployment or production improvement is claimed.
