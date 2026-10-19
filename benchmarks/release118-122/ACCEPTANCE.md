# Kukureku Releases 118–122 — image-region OCR review on hybrid PDFs

This batch adds a **user-invoked review-only OCR workflow** in the developer Inspector. It does **not** autonomously classify embedded graphics as tables, merge recognized text into native words, overwrite source PDF, or add unsupported cells to XLSX. Everything executes locally in the browser.

| Release | Implemented scope |
| --- | --- |
| 118 | Track PDF.js image-paint bounding boxes using save/restore/transform graphics state, with count and clipped page-space rectangles; do not retain image pixels |
| 119 | Bound optional OCR candidate images by area, dimensions, near-empty native-word overlap, redundant region intersection, at most two regions/page and four per document |
| 120 | Render selected original PDF pages and run local Tesseract OCR on selected image rectangles after explicit invocation; keep the output unverified and separate from logical tables |
| 121 | Add the opt-in OCR review button and page-specific review transcript, confidence and warning to Engine V4 Inspector |
| 122 | Add geometry/false-positive tests and numeric original-publisher image rectangle diagnostics while preserving the original independently labelled logical table IoU gate |

## Acceptance and safety
- Preview deployments disabled until entire batch passes CI. Consolidate into one production deployment, never five.
- Existing USGS real-publication tables and published PMC logical-table IoU requirements remain unchanged.
- Phase 10.14 OCR, PDF-to-XLSX, browser reliability, TypeScript build, lint, unit and tool routes must pass.
- Embedded images in ordinary text pages are not necessarily tables; image coordinates are a review aid, not table detections.
- No external document, recognized text or private file is sent to any server; OCR uses the browser-local Tesseract package.
- Source-page image paint metadata can be informative, but the six third-party annotation boxes remain **detection-only** labels. Formal V4 Stable independently reviewed-document qualification is still 0/20.
- Current independently annotated PMC score before this batch is 1/6 published boxes at IoU >= 0.50; do not claim an improvement unless the actual benchmark measures it.
