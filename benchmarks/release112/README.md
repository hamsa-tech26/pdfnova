# Release 112 — published table-location benchmark

Status: **scoped detector repair under review** — 1/6 publisher table boxes now matched at IoU >=0.50 (previously 0/6), with a measured best IoU of 0.9785. Five published boxes remain unmatched; no V4 Stable certification.

## Motivation
- Issue #70 documented a historical absence of USGS tables in an earlier three-page excerpt. Current browser regression checks the five full published table pages, so historical zero-table results cannot be represented as current without rerunning the original.
- Issue #75 found no indicative IoU >=0.50 matches against broad prose/visual-block proxies for six third-party table boxes. This is not a formal measurement of logical table detection.
- The new experiment compares actual V4 logical table bounds and original PDF page numbers against independent PubTables-1M Detection Test XML.

## Sources and scoring scope
- SHA256-pinned original 7-page PMC1064082.1 and 14-page PMC1064098.1 publisher PDFs.
- SHA256-pinned 4.49MB external detection annotation archive, five annotated original pages and six table boxes.
- XML top-origin image bounding boxes are converted to bottom-origin PDF units, using the actual V4 page dimensions.
- A true table rectangle is taken from inspector logical table bounds, not an arbitrary broad paragraph block.
- One-to-one IoU >=0.50 matching; count missed published boxes and unmatched predictions, never double-credit.
- All downloaded documents/XML and raw Inspector output stay only on ephemeral CI runner. Committed artifacts contain source hashes and numeric summaries, no original text or PDFs.

## Acceptance boundary
This measurement can reveal a defect but cannot prove improvement just because CI completes. A detector modification requires verified before/after counts, visual coordinate validation, and unchanged false-positive behavior. Existing 147-cell USGS, 132-cell PMC, 231-cell PMC, 84-cell PMC, Chrome reliability, OCR, type, lint and build regressions must remain green.

Do not lower detector thresholds globally, infer unsupported cells, claim independent document accuracy or increment 0/20 formal Engine V4 Stable qualification.

## R112 observed after-code measurement

The baseline was 0/6 published table boxes at IoU >=0.50 with 3 unmatched predictions on annotated pages. A conservative native-dense-grid isolation now matches PMC1064098 original page 7 at IoU 0.9785, giving 1/6, with 2 unmatched predictions. The other five boxes remain unresolved, including image-only content and prose-like two-column regions. The native segmentation requires seven aligned data rows and excludes OCR, drifting anchors, and long parallel text. This is **only** a target-sample improvement, not an independently adjudicated six-table cell/structure score. Production release is gated by measured browser replay and pre-existing regression workflows.
