# Cancellable redaction and real-reference refusal investigation

Base: PR #132, `12a1d03523484eb300b48be303284cc0b4b6674c`, stacked on
PR #130, `f4267570e893092d28e6adf185242bcc60ab3480`. PR #131 is unchanged;
its header-fidelity correction is not included in this stacked candidate.

## Confirmed corrections

The redaction UI exposes Cancel and passes an AbortSignal through the exporter.
PDF.js loading and active RenderTasks can be interrupted. Image loading has an
abort listener; PNG embedding and serialization have cooperative checkpoints.
The exporter yields after save, before returning bytes, so queued cancellation
cannot download a completed-but-cancelled result. The UI checks again before
its synchronous download commit point. Cancelling after that point cannot
recall an already initiated download.

Renderer backing stores are released before the consumer callback. The masked
canvas and Image are released after encoding, before compression/input yields,
and again in finally on errors. Source-page cleanup and document destruction
remain in finally. Immediate per-page PNG embedding, opaque compositing,
outward pixel mask bounds, physical geometry and original-object exclusion
are preserved. No lossy codec is introduced.

Admission limits: 25 MiB input; 100 pages; 3200-pixel longest raster dimension;
10.24 million pixels per page; 120 million cumulative rendered pixels;
64 MiB cumulative encoded masked images; 128 MiB final output; two minutes.
Declared image streams are inspected before preview/export decoding: at most
16 million pixels per image and 64 million across the input, including masks
and unused image objects. A 300-dpi derived FBI scan is admitted; the 600-dpi
8400×5100 control is refused. These are conservative engineering limits, not
qualified mobile budgets or a hard browser-memory guarantee. Inline images,
codec working memory and synchronous library calls still require further
resource isolation. A deadline cannot preempt synchronous JavaScript.

## Four real-reference refusals

`real-reference-diagnostics.json` contains source hashes and actual browser
pipeline observations, without raw PDF bytes or copied cell contents.

- FBI: one possible candidate, score 47.88, not a confirmed table. Default
  structure recovery is skipped; diagnostic outcome remains `pending`.
- USDA: confirmed region spans table and adjacent chart content. Eight columns
  and 17 physical lines collapse into one logical row; structure quality gate
  withholds export.
- Invoice: one possible candidate, score 49.65; default structure recovery is
  skipped. The actual first source table has nine columns and five rows.
- NREL: one possible whole-page candidate, score 54.39; default structure
  recovery is skipped. Actual seven-column table is a small region below prose.

No OCR runs on this automatic native-text route. No workbook-generation failure
occurs: all four default attempts are stopped before workbook generation.
They are coverage failures, not successful conversions or inaccurate workbooks.
Exact downloaded-workbook cell/row accuracy for these four is N/A.

A diagnostic-only run enabled the existing `includePossibleTableRegions` option:
FBI collapsed to 1×23; USDA remained 1×8; NREL became a prose-contaminated 6×9
region rejected for overlap. The invoice became an incorrect 2×5 region which
passed export planning. No workbook was generated from this experiment.
This is evidence against globally enabling possible-table recovery. No detector
thresholds, cell contents, OCR or workbook quality gates were changed.

Future recovery needs native physical row segmentation and bounded table-region
isolation; changing candidate admission alone is insufficient. A general recovery
fix is intentionally unresolved until source-complete evidence supports it.

## Public provenance and independent evidence boundary

FBI, USDA and invoice bytes come from jsvine/pdfplumber revision
`4c64b92d5caccd71c645e98e0fabb0c4dba7ff45`, at the paths recorded in
`e2e/real-table-refusals.pilot.mjs`. NREL `tests/files/foo.pdf` comes from
camelot-dev/camelot revision `92777b852e00933a5c4b9ba642601784604356cd`.
Mirror hashes are recorded; fresh publisher authentication is not claimed.

PDF.js pipeline observations were compared with separate pdfplumber region/grid
extraction and MuPDF-rendered page inspection. The invoice's external maintainer
assertions in `tests/test_table.py::Test::test_edges_strict` and
`test_rows_and_columns` cover the header, UPC column and final row. Neither those
partial assertions nor separate software readers establish independently blind
reviewed complete cell references. The adjacent `foo.csv` in Camelot is an
unrelated 2×2 serialization fixture and is NOT a reference for the NREL table.

**Missing independent complete reference review remains a certification blocker.**
Engine V4 Stable remains unverified. Constructed controls, metadata-only evidence
and known-refusal tests do not qualify real-document accuracy.

## Reproduction

Use `npm ci`, `npm test`, the explicit OCR command from Validate, `npx tsc --noEmit`,
`npm run lint`, `npm run build`, registry/output/golden/security checks, and the
complete zero-retry Playwright suite. New cancellation tests cover source reads,
active renders, image embedding, final serialization, resource cleanup and retry.
Existing positive XLSX reader/download controls remain in the complete suite.

For the four negative real-reference regressions, download the pinned public
corpora into sibling `pdfplumber/` and `camelot/` directories, set
`KUKUREKU_REFERENCE_ROOT` to their parent and use a Playwright config selecting
`e2e/real-table-refusals.pilot.mjs`. Missing corpus input fails explicitly.
Detailed exact-commit receipts, performance trials and independent downloaded-PDF
pixel checks are supplied in the task delivery report. Raw documents and raster
references stay local and are excluded from that metadata/log delivery.

The new branch is disabled in vercel.json before its first push. No merge,
deployment, paid service, Smart Scanner, Android work or historical PR closure.
