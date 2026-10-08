# Phase 10.14 — OCR stress benchmark

The four synthetic PDF generators are in `scripts/generatePhase10_14[a-d].mjs`. This benchmark records ground-truth rows from the generators and **never fabricates OCR results**.

Run `npm run benchmark:ocr:baseline` to create an explicit `NOT_RUN` report. This verifies report generation, NOT OCR accuracy.

Once actual Engine V4 outputs have been captured as JSON, run:
`node scripts/scorePhase10_14.mjs path/to/actual-results.json`

The JSON must be an array of objects `{"id":"10.14a","rows":[["1","..."],...]}` for fixture ids `10.14a` through `10.14d`. The scorer calculates exact normalized cell and row matches. Missing fixtures have `NOT_RUN` status and cause a nonzero exit when an input path is supplied. Missing cells are counted as failures; extra rows prevent an exact match.

The output `benchmarks/phase10_14/reports/latest.json` should be treated as a local artifact, not committed as evidence without the corresponding input and provenance. The scoring test cases are unit tests of the scorer only. **Real OCR accuracy remains unverified until actual results are collected.**

The dedicated GitHub Actions workflow **Phase 10.14 Real OCR Benchmark** launches Chromium against `/engine-inspector` with the actual four committed synthetic PDF fixtures, downloads the V4 result JSON, selects the largest confirmed logical table independent of ground truth, and writes the extracted rows to `reports/raw/10.14[a-d].json`. The collector combines these into `reports/actual-results.json`, and the scorer records exact positional row/cell metrics in `reports/latest.json`. The workflow uploads all reports as a 14-day Actions artifact. A failed OCR run remains `NOT_RUN` and fails the benchmark workflow; failed/weak extraction remains visible rather than being edited to pass.

This benchmark is diagnostic, not a production accuracy certification. It uses synthetic English tables only. Real documents, multilingual samples, table geometry and expected row-alignment strategies need separate acceptance thresholds. Browser OCR may need to download English language models during initialization.

CSV export for confirmed V4 tables is available through the existing Engine Inspector; the download is text/columns only, with spreadsheet formula protection. The full V4 JSON should be retained when provenance matters. Do not treat CSV output as authoritative without reviewing the source PDF.

## Release acceptance gate (intentional blocker)

`node scripts/checkV4ProductionGate.mjs benchmarks/phase10_14/reports/latest.json` checks all four measurements, actual OCR execution, matching data-row counts, at least **95% exact cell accuracy** and **75% exact row accuracy** per fixture. Unlike the diagnostic benchmark it deliberately exits nonzero on insufficient accuracy. These thresholds are an initial minimum synthetic-fixture gate, **not** a declaration that all Phase 10.14–10.20 milestones are production-ready.

As of 8 October 2026, fixture 10.14d has 42.22% exact cells and 11.11% exact rows, so promotion must remain blocked. CI validation/build success does not override this gate. The acceptance step runs after artifact upload so failed scores remain inspectable.
