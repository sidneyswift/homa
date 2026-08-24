# Extraction audit

Audit date: 2026-08-24

## Completeness result

The archive passes its structural and file-integrity checks:

- 206 of 206 PDF pages have page-level Markdown transcriptions.
- 206 of 206 PDF pages have readable JPEG screenshots.
- Every screenshot is a valid 1405 by 1989 pixel JPEG.
- The manifest covers pages 1 through 206 exactly once.
- The grouped archive contains 12 strategy modules and 33 play modules.
- All 255 Markdown files were checked.
- All local Markdown links resolve.
- No extracted Markdown file contains an em dash.

## Manual visual checks

The full-page screenshots preserve readable text, layout, illustrations, and
embedded product examples. Manual checks covered the cover, setup workflow,
strategy pages, play overview and prompt pages, visual example pages, and the
final page.

The screenshots remain the visual source of truth because the PDF text layer
does not reliably recover decorative headings or words embedded in product
screenshots.

## Confirmed source anomalies

- PDF page 38 is labeled Habit Formation but contains Premium Positioning
  diagnostic questions.
- PDF page 41 is labeled Premium Positioning but contains Habit Formation
  diagnostic questions.
- The System Widget companion list repeats Gamified Progress.
- The Variable Reward companion list repeats Intentional Friction and calls
  Spark Curiosity only "Curiosity."
- Monetisation defines ARPU using active users, while Premium Positioning uses
  total users. A future Homa score must use one project-owned definition.

These anomalies are preserved in the page-level archive and called out in
[`FRAMEWORK.md`](FRAMEWORK.md). They have not been silently corrected in the
source transcription.

