# Kukureku Releases 113–117 — real-document table reliability batch

This batch is a **scoped improvement**, not formal PDF Engine V4 Stable certification. The six original published table boxes are a small publisher-specific diagnostic; 0/20 independently reviewed real documents remain accepted for formal V4 qualification.

## Release 113 — multiple native numeric grids in a source block
Allow up to three disjoint, high-evidence native row runs per long PDF paragraph. Each run requires seven strong numeric rows with repeating separated column anchors. Preserve every source word and OCR provenance; do not absorb narrative outside the region.

## Release 114 — constrained candidate precedence
An overbroad caption/column candidate may be replaced by a more tightly bounded high-evidence grid only when its original line interval contains the compact candidate and its height is at least 1.65x as large. Protect existing eleven-column, interleaved, and parallel scientific special cases. Preserve other disjoint caption tables.

## Release 115 — optional image-paint inspection
Inspect PDF.js page graphics operators only when explicitly requested by the developer Inspector. Count actual PDF image paint operations, not unknown raster content or fictitious text. Do not slow normal production document reading, image conversion or PDF-to-XLSX with an extra operator walk.

## Release 116 — image-content review signal
When a page contains both sufficient native text and image paint operations, show an evidence-only warning in Inspector that text **inside images is unverified**. Do not auto-trigger Tesseract for native-text pages, claim detected table cells, or silently alter user documents.

## Release 117 — original publisher regression and accountable results
On exactly two SHA256-pinned independent publisher PDFs, evaluate actual logical-table rectangles against PubTables-1M Detection Test XML. Require a page-7 match with IoU >= 0.95, maintain >=1/6 matched boxes total, <=2 unmatched predictions, and assert image review and source-page counts. Keep real USGS 147-cell XLSX and existing original PMC/OCR/browser regressions green.

**Non-goal:** Do not mark other five table boxes solved, claim 100% page reliability, or promote Formal V4 Stable. Never upload publisher PDF text, source PDFs, or raw Inspector output. Keep no-cost deployments consolidated into one production build only after passing exact-head CI. This technical phase is justified even when the real-document benchmark does not improve past 1/6; improvements must be stated only when measured.
