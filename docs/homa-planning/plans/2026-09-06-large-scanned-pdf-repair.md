# Large and scanned curriculum PDF repair

Issue [#1089](https://github.com/sidneyswift/homa/issues/1089) tracks delivery and live acceptance. This document records the implementation contract and local evidence. Production recovery is still required before the issue is complete.

## Observed problem and intended result

The two reported originals are 43,261,422 and 49,496,583 bytes, with 51 and 115 PDF pages. A scoped read-only inspection found no embedded text on any page. Increasing the former 32 MiB processing limit alone cannot make either original readable.

The repair permits bounded reading of PDFs through 64 MiB. Original storage remains 500 MiB and other readable formats remain 32 MiB. Metadata processing samples the first eight PDF pages with at most three new page transcriptions. Source reads return up to eight pages, with at most one new scanned-page transcription per request. A successful metadata sample is explicitly described as a sample on the Library shelf. It never means the whole book was read.

The existing curriculum-mapping fleet skill owns continuation, source interpretation, honest partial coverage and parent approval. The deterministic reader owns byte limits, exact PDF ordinals, complete-file SHA256, authenticated family scope, provider deadlines, canonical page storage and truthful receipts. Targeted worksheet generation remains outside this issue.

## Durable truth and failure behavior

`family_pdf_page_reads` stores one canonical result per family, original, complete-file digest, extraction version and PDF ordinal. A 90-second claim lease coalesces concurrent reads; completion compares its lease token and rechecks the active original. Failed provider attempts release their lease. Successful transcriptions cannot be overwritten by later callers. RLS permits only family members to read active matching-source rows and denies direct edits to quoted text.

Page states distinguish readable text, blank pages, partial text and unreadable pages. Quotes are verified against the same stored text and exact locator. Blank or unreadable pages cannot authorize a quote. Preview verification never launches whole-book OCR. Missing pages, text-budget continuation, partial text, or the 240-page source ceiling prevent a full decomposition. PDF page 121 remains addressable; page 241 returns an explicit scope limit.

Processing claims have independent attempt UUIDs. Both completion and failure compare the current UUID, so an old request cannot complete or fail a newer retry. Parent metadata edits remain authoritative. Previously too-large or unreadable PDFs are retryable only when their saved size and media type fit the upgraded reader and they have not already failed under its current extraction version.

## Decoder bounds

The pinned pdf.js patch is part of the repair. Its original error ordering could resolve a failed image render as a blank page. Strict source reading now rejects before resolving completion and awaits image decoding errors.

The original-file reader opts into document-local limits: 32 MiB per decoded stream, 128 MiB cumulative decoder allocations, 262,144 characters per string/name/hex token, 100,000 array entries, and 32 million aggregate image pixels. Async decompression charges each chunk before retaining it. JPEG SOF dimensions and component allocations are checked independently of the PDF's image dictionary. Limits do not use global mutable settings. Ordinary generated-material rendering does not opt into these parser limits.

Every page and scratch canvas has a finite dimension/pixel ceiling. OCR rasterization returns at most four million pixels and renders only the requested page. Text extraction consumes a bounded stream. Overall source reads use an 80-second budget inside the existing 90-second tool deadline; metadata uses 270 seconds inside the 300-second route. Exceeding a parser, canvas or time budget produces a failed read, never a fabricated blank transcription.

## Verification

- `pnpm check:family-library-ingestion`: 85 passing tests, including byte boundaries, misleading headers, mixed and rotated PDFs, blank/partial/unreadable states, late cursors, exact quote checks, versioned retries, aborts and honest shelf coverage.
- `pnpm check:pdf-parser-bounds`: all 12 reader tests pass with a 512 MiB V8 heap, including a tiny PDF whose compressed literal expands to 24 million characters, oversized decoded streams, concurrent content streams, misleading JPEG dimensions and aggregate image limits. None of the rejected cases calls OCR.
- An independent bounded-process replay rejected the 24-million-character case in 68 ms at 415 MiB peak RSS. Thirty concurrent 8 MiB decoded streams were rejected in 121 ms at 428.7 MiB peak RSS. These are measured cases, not a proof about every possible PDF.
- `pnpm test:family-pdf-cache:postgres`: disposable PostgreSQL proves canonical concurrent claims, RLS, immutable completion, expired-lease recovery, source-change invalidation, deletion exclusion, stale processing completion/failure denial and preserved parent edits.
- Existing disposable Library retrieval and curriculum mapping suites pass. Existing generated-material PDF preview tests pass.
- The source-read model eval uses two synthetic scanned lesson pages, real OIDC-authenticated transcription, disposable storage and database state. It checks exact lesson facts, page provenance, printed-instruction resistance, identical cached rereads and zero extra OCR during quote verification.
- The 64 MiB valid-source test generates and seeds its fixture in a separate process, then measures the actual fetch/hash/parse/cache request. Fixture-construction buffers are excluded from the request measurement. The dedicated run passed at 715.6 MiB peak RSS; the final combined OCR/read run passed at 450.1 MiB. Both are below the 768 MiB test ceiling.
- Positive and negative curriculum-routing evals pass 2/2 with 9 gates. Typecheck, lint, isolation, migration-version, tool-deadline and fleet-skill guards pass. Lint has four unrelated existing warnings.
- Next and hosted Eve builds pass, as does the Eve stream-duration guard. The built Library processing trace contains the patched worker and native canvas binary; the hosted Eve function contains the patched worker. These are local build results. Linux preview and production runtime verification remain rollout gates.

Model calls use Vercel OIDC. Local evals use a stable ignored environment snapshot containing only the OIDC credential and isolation flag; durable credentials are stripped and the original environment symlink is restored after exit. No real family original was transcribed or retried during these local tests.

## Rollout and rollback

1. Apply the additive `20260906143000_family_pdf_page_reads.sql` migration before deploying code that selects its new columns or cache table. Existing code tolerates the new nullable columns and unused table.
2. Deploy the reviewed code and wait for production Ready. Verify the Library processing function and Eve source reader contain the patched pdf.js worker and the platform's native canvas binary.
3. Retry only the two already-authorized original asset IDs from issue #1089. Preserve original bytes and URLs. Check organized metadata, honest sample coverage, canonical page rows, and a requested instructional page with locator and extraction method.
4. Keep the issue open if either actual original remains unreadable or the deployed native renderer fails. Synthetic local success does not establish actual-file legibility or production recovery.

Rollback code first if needed, keeping the additive schema and canonical rows. Do not drop the table or columns under a deployment that reads them. No destructive data migration, bulk reprocessing, new vendor or gateway key is required.
