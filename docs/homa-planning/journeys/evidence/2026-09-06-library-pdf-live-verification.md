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

Dimensions Teacher's Guide PKA remains under recovery. Its first attempt cached physical pages 1-2 and then failed on page 3. The 40.759-second interval strongly suggests the configured 40-second transcription deadline, but the original exception was discarded. A separate exact-page diagnostic on the same failed attempt and source failed after 40.014 seconds, returned a wrapped status 500 and left the enclosing page signal un-aborted. It preserved the original failed state and released the page lease. An offline reproduction against the actual installed AI SDK and Gateway adapter showed that a local timeout is wrapped as a status-500 GatewayResponseError, while an actual HTTP 500 becomes a different GatewayInternalServerError. The diagnostic retained neither distinguishing name nor cause, so its numeric 500 is insufficient to identify a provider outage. A product correction is being investigated before another recovery attempt. No successful second-book recovery or complete-book extraction is claimed, and #1089 remains open.

Raw original page images/text and private source URLs are excluded from this committed evidence. The private local reports retain the detailed receipts for the operator's comparison.
