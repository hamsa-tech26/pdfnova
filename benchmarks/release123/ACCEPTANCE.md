# Release 123 — public, opt-in image OCR with user-confirmed XLSX

**Scope**: Public PDF-to-Excel page, not automatic table conversion.

1. User explicitly selects **Inspect embedded images for optional OCR**; browser-local V4 inspection collects image paint geometry without automatically using the OCR text for any table cells.
2. User explicitly selects the PDF page and clicks **Run image OCR on selected page**; browser-local Tesseract returns unverified image-region text and confidence.
3. User chooses the source image region, enters/edits a **TSV grid** with headings, previews the exact table cells, and checks confirmation after comparison with the original PDF.
4. A separate **User-Reviewed Image Table** XLSX is exported, containing the exact user-entered cells, with a **Review Notes** sheet recording source page, image bounds, OCR confidence, and the fact that cells were user reviewed rather than verified by the engine. All cells are literal string cells and cannot execute formulas.
5. Changing page/region/input resets the preview and confirmation. The automatic native-only PDF-to-Excel path and source cells remain untouched, and uncertain OCR never auto-downloads or merges into native tables.

**Bounds:** Source images must meet the existing R119 conservative evidence gate; user grids require 2–100 rows, 2–20 consistent columns, nonempty headers, 30K input characters, 1K per cell, no blank data rows. The source review must have at least 2 OCR words and confidence >=45, but this is *not* cell accuracy certification.

**Regression:** Real raster text embedded in a PDF with selectable narrative text, actual browser local Tesseract, explicit confirmation, XLSX ZIP verification, formula literal defense, native converter independent browser tests, original USGS document pilot, OCR benchmark, publisher spatial table benchmark, and browser reliability suite.

**Non-goals:** No automatic image-table cells, no numerical coercion, no API upload, no changes to V4 table recognition, no claims that the five remaining published table-box misses are solved. Engine V4 Stable independent 20-document gate remains 0/20.
