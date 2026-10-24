# Task 175 — independent XLSX reader on real publisher source

Production starting point: 0d42c81091617d30194a669b0c543f522065b5bd.

The USGS OFR 2024-1025 real-PDF browser regression compares 147 cell strings in
five exported sheets to the existing **project-transcribed** publisher reference,
but historically inspects raw OOXML through regular expressions. That is
insufficient to prove another spreadsheet application sees the same values.

This change retains the original reference, source hash and all original
inspector and browser checks while adding an **independent openpyxl read of the
actual downloaded XLSX**, matching all 147 cells across the five observed
worksheets. It also refuses formulas, unexpected external workbook links,
unexpected dimensions, missing review warning and unexpected sheet counts.
It writes a temporary private JSON reference within the Playwright test output
and uploads neither workbook nor reference text. CI logs only aggregated counts.

This is independent XLSX parsing, NOT independent human reference annotation
or independent real-world certification. The five-page source excerpt and
project's manually transcribed expected cells are still previously exposed
development data. No V4 Stable credit is granted (0/20). No detector threshold
or production conversion code has changed.

CI must succeed on the exact PR head, especially the complete published PDF
pilot and all five matching USGS table regions, before any release decision.
The draft branch's Vercel deployment is disabled from its first commit.
Do not merge or deploy without separate owner approval.
