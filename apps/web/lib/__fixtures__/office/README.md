# Office extraction fixtures

Synthetic files for deferred document parser regression coverage. No family data.

- `reading.docx`: minimal OOXML ZIP generated with Python zipfile, containing `Reading practice: café, 日本語.`.
- `counting-xlsx.xlsx` and `counting-biff8.xls`: generated with the installed SheetJS writer, containing an Activity/Count header and `café 日本語`, 10 in the Practice sheet.
- `counting-biff5.xls`: the older BIFF5 format, written with code page 1252, containing `café £`, 10. The writer replaces non-ASCII BIFF5 label bytes with underscores, so the unique `caf_ _` label was replaced with the same-length CP1252 bytes `63 61 66 e9 20 a3`, then verified with the existing reader. This exercises the encoding tables that must remain available when the parser is loaded later.

Tests serve these bytes through the existing download seams, without replacing the document readers. Startup profiling separately checks whether the readers execute during an ordinary text startup.
