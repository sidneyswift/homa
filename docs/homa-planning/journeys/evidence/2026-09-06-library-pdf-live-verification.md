# Library PDF live verification, September 6

Source/spec: [F16 feedback](../../plans/2026-09-05-cofounder-feedback-review.md#f16-make-an-accepted-curriculum-actually-readable), [repair contract](../../plans/2026-09-06-large-scanned-pdf-repair.md), [#1089](https://github.com/sidneyswift/homa/issues/1089).

## Deployment

PR #1114 merged the repair at `40359589c8d6ea6a4be40118bfa8765c8b610926`. Deployment `dpl_FowhbTVDzit3FgtB5j6JRecbz1B6` reached READY and served `thankshoma.com`; the public page returned HTTP 200. The subsequent child-scope merge `69abbefdd2cc507c55f07c577c1235ce27168626` preserves the PDF repair. Its deployment `dpl_3aQ7ddFj8HshhS7FhV7vvYL2GSfP` was independently verified READY and serving that same production alias before the hosted test below.

The additive PDF-page schema was applied under production ledger version `20260906164417`, name `family_pdf_page_reads`, from source migration `20260906143000_family_pdf_page_reads.sql`. Authenticated access to the cache is SELECT-only with RLS; processing retains the family-scoped server write path. The differing ledger timestamp is recorded to prevent duplicate application.

## Actual hosted upload and reader

At 17:09:54-17:10:41 UTC, the independently reviewed probe `2bb9c3f1f8f4ae3ce736bd7cb1f31f2a33aba51a9e843fc3b38ac48396f3daaa` exercised production with one fresh synthetic sandbox family. No existing family's membership, uploads or billing were changed.

- Constructed a 15,527-byte, one-page PDF containing only a raster image. Local parsing confirmed no embedded text. Full SHA-256: `23d444ee9e25cab257c72f1478e22f112d12f909192427383da179687973c387`.
- Used a real new-user JWT through the deployed Library reservation, token, multipart start/part/completion and asset-finalization paths. Each mutation was attempted once. Every application/storage response returned HTTP 200.
- The deployed processor produced Ready metadata with the explicit page-1-of-1 coverage note and a canonical readable page at `pdf-pages-v1`. Its full source hash and ordinal matched; vision extraction reported no gaps. All four exact synthetic lines survived, including the lesson number, six-shell count and instruction.
- Observed one vision receipt, one metadata receipt and one embedding receipt, plus the final processing event. Completion, receipt IDs and absence of page leases remained stable over three reads before cleanup. The run passed 322 assertions, including repeated ownership and cleanup checks; this is one hosted journey, not 322 independent feature scenarios.
- The real authenticated asset DELETE returned HTTP 200. Guarded cleanup then verified zero remaining fixture Auth users/sessions, memberships, family, children, Hours, assets, reservations, tags, page-cache rows, events, model receipts and messages. The canonical deletion job and artifact-denial tombstone remain for the normal provider sweep/token-drain lifecycle. Full provider account deletion is not certified by this fixture shortcut.

This proves hosted PDF decoding/rendering, vision, canonical storage, metadata and original deletion for the one small scan. Large-file byte/memory tests and recovery of the two original books are separate evidence.

## Original books

The operator uses the clean reviewed source `57348332a400ed8e4a4337c929636bae174b537d` against production data, with the two exact asset IDs, complete checksums, ownership and original locations guarded. It does not impersonate a member. The missing local private-Blob credential was supplied only to a filtered temporary process through Vercel's existing production environment; no environment file was rewritten and the generic Blob token was not substituted.

Preschool Math at Home reached Ready metadata. Physical PDF page 11 contains printed pages 20-21, including a complete counting lesson. Visual comparison confirmed its title, five-toy materials, one-to-one pointing/counting sequence and final quantity question. All seven persisted page fields deep-equal the fresh read; the initial operator replay failure came from comparing JSON property order. The corrected ordinary page-read and replay probe subsequently passed with zero new transcription calls and the same 1,201-character text checksum, `37187912925ae55155ea78f0d91cb46831b10269abda833d98c2500de2536b92`. The full source bytes/hash, size and original URLs are preserved.

Dimensions Teacher's Guide PKA initially failed after two cached pages. The 40.759-second interval strongly suggested the configured transcription deadline; a second diagnostic failed after 40.014 seconds with a wrapped status 500. Installed-SDK reproduction showed that a local timeout can acquire that wrapper status, so this did not establish a provider outage. The original discarded exception remains unproven; it is not retroactively reported as a confirmed provider timeout.

## Dense-page correction and completed recovery

[PR #1116](https://github.com/sidneyswift/homa/pull/1116) merged at `78466fe63311f8a14934ada7fc569d95a3742a24`. Deployment `dpl_9XwpaN8FuxQPxBkQ8mwQa3QF3vEV`, `homa-6x73d625r-homa-1d878b0e.vercel.app`, was independently matched to that Git SHA and verified READY with the `thankshoma.com` alias and HTTP 200 before recovery. The correction sets the existing Gemini 3 Flash transcription to explicit minimal thinking, retains the same output/deadline limits, and records safe typed failure causes. A later timeout/provider failure preserves already verified earlier page text with explicit partial coverage. No PDF schema or parser dependency changed in this correction.

The versioned operator is pinned to clean source `78882fd86bb7329bb1b84b54f8d9762e28ccfbdf`, SHA-256 `659ff3c4a7d44d76f6483aca4342050f0aa8def77e28a1ddc6e696bb9a0ffcfc`. Its filtered environment wrapper is `a62f8daed80cb53ee8048583773322dad0ef3ea9c1ca5f79d50f873ebefadeff`. Root read both complete files and independently reran the offline authorization/replay/diagnostic checks. This remains reviewed local source operating on production data, not a hosted Eve request.

- At 18:20 UTC, the exact failed second-book attempt and source passed the guarded page-3 diagnostic. Transcription took 5,289 ms by both monotonic and wall clocks, within the unchanged 40-second budget. The result has 1,138 characters, no reported gaps, and checksum `43ff1d41a013eaa58e003ebecb891f677b979d64bd5268b4badd8f70bf7bd592`. Root visually compared the publisher/title and both chapter/lesson/page columns with the scan. Canonical replay was identical with zero additional OCR, and the failed metadata attempt remained unchanged until the separate retry.
- The single guarded retry completed at 18:22:59 UTC. Attempt `5fcf2990-15bf-46af-8bb5-01b7750171ca` is Ready at `pdf-pages-v1` with no error. Full original bytes were hashed before and after; 49,496,583 bytes, 115 physical pages and SHA `b66babd5d88d39a4bfc2569eca3c811d63b5f7b002864c97c5dc69a27d7e33cb` are unchanged, as are both original URLs. Metadata explicitly says it used pages 1-6, that remaining pages have not been read, and that some sampled content is incomplete. Page 1 remains honestly partial. No direct Ready override was used.
- A separate ordinary authorized source read verified physical page 17, printed pages 6-7, Lesson 1 Red and Blue. Root compared its objective, red/blue materials, different-shade examples, sorting/matching instructions and the circle/blue-crayon sequence with the actual image. It returned 2,192 characters, no reported gaps, text SHA `cc7d1cb70a2842ebd844da77a8c3e6a3dd7ff310771f0814ce45dc58fb5ad391`, one new OCR and an identical zero-OCR replay. All page leases were released and metadata stayed Ready.

The diagnostic, retry and instructional-read run IDs are respectively `161d967b-c00e-4dd3-af11-beaf23cd258a`, `63c67790-b518-48f1-bcbe-10bd3d2283a4`, and `1b58bb48-1d86-41f4-b9bb-21cca4410ac4`. The private reports are under `/tmp/homa-feedback-implementation/pdf-original-private/dense-recovery-78882fd8`. The first original remains Ready with its separately verified counting lesson. Both reported original-book blockers are repaired; complete-book OCR, every possible damaged scan, and the broader owned-lesson teaching workflow are not claimed by this release.

Raw original page images/text and private source URLs are excluded from this committed evidence. The private local reports retain the detailed receipts for the operator's comparison.
