# Kukureku Releases 124–128 — Reviewable OCR Table-Grid Suggestions

## Five targeted improvements
- **124 — Preserve bounded OCR word geometry:** existing region OCR retains page-local word x/y boxes and confidence, exposing an ephemeral, per-image structured proposal. No image data or transcript is sent to a server.
- **125 — Reconstruct tentative rows and columns:** sort source Tesseract words by rendered page y, group by bounded line-height tolerance, merge adjacent glyph words, and use repeated left-edge anchors for 2–6 candidate columns.
- **126 — Reject weak evidence:** withhold suggestions if rows are unequal, columns drift, numeric data evidence is absent, words are low confidence, or page coordinates are invalid. Never treat prose columns as tables.
- **127 — Public editable proposal:** offer **Copy tentative grid for manual correction** only when bounded evidence passes. This populates editable TSV; does not preview, confirm, or download. Existing manual editing, preview, explicit approval and separate reviewed XLSX remain mandatory.
- **128 — Regression and browser acceptance:** pure source-geometry tests on valid/invalid image OCR layouts; independent real browser path with raster data embedded in hybrid PDF checks refusal or tentative copy never auto-approves; preserve native PDF-to-Excel, real USGS, OCR and browser baselines.

## Accuracy and release boundaries
No new claims about automatically extracting tables or verified cell accuracy. The six-box independently annotated published PMC table detection result was **1/6 at IoU >=0.5** as of Release 123 and may not improve from review-only work. **V4 Stable 0/20** independently reviewed documents. Do not merge or deploy without same-head CI, including mandatory browser XLSX and public USGS workflows.

This batch conserves Vercel quota: development-branch preview builds disabled, single production deployment after passing CI.
